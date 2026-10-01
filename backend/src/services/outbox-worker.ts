import { prisma } from '../lib/db.js';
import { eventMatches } from '../lib/event-types.js';
import { queueWebhookDeliveries } from './webhook-delivery.js';
import { notifyTeamChannels } from '../lib/team-notify.js';
import { notifyInboxMembers } from '../lib/inbox-notify.js';
import { maybeSendAutoResponse } from '../lib/auto-response.js';
import { maybeSendCsatSurvey } from '../lib/csat.js';
import { sweepStagedAttachments } from '../lib/attachments.js';

/**
 * Outbox polling worker — ADR-0006.
 *
 * Reads unpublished `outbox_events` and fans them out:
 *  - to the workspace's own webhook subscriptions: one queued
 *    WebhookDelivery per matching subscription, which
 *    services/webhook-delivery.ts sends, retries and logs;
 *  - to the team channels, inbox email, auto-response and CSAT
 *    consumers below;
 *  - to subscribed Forjio services via Huudis subscription CRUD — not
 *    implemented yet (wire up once Huudis M2 ships it).
 *
 * Each row is marked published exactly once, in createdAt order, after
 * its webhook deliveries are queued (so a crash before that re-runs the
 * idempotent queueing instead of losing them).
 */

const POLL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1000);
const BATCH = Number(process.env.OUTBOX_BATCH_SIZE ?? 100);
/** Staged-attachment sweep cadence (the rows themselves expire after
 *  1h — see lib/attachments.ts STAGED_TTL_MS). */
const ATTACHMENT_SWEEP_MS = Number(process.env.ATTACHMENT_SWEEP_INTERVAL_MS ?? 10 * 60 * 1000);

let stopped = false;
let lastAttachmentSweep = 0;

export async function startOutboxWorker() {
  console.log(`[outbox] polling every ${POLL_MS}ms, batch=${BATCH}`);
  while (!stopped) {
    try {
      const batch = await prisma.outboxEvent.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
      });
      for (const ev of batch) {
        await deliver(ev);
      }
      // Piggybacked housekeeping: drop staged attachment uploads
      // (messageId = null) older than 1h every ~10 minutes.
      if (Date.now() - lastAttachmentSweep >= ATTACHMENT_SWEEP_MS) {
        lastAttachmentSweep = Date.now();
        await sweepStagedAttachments().catch((e) =>
          console.error('[outbox] attachment sweep failed', e),
        );
      }
    } catch (e) {
      console.error('[outbox] loop error', e);
    }
    await sleep(POLL_MS);
  }
}

export function stopOutboxWorker() {
  stopped = true;
}

/** Does this subscription's allowlist match the event type? `["*"]` (the
 *  default) matches everything, `suppuo.ticket.*` a prefix. */
export function subscriptionMatchesType(events: unknown, type: string): boolean {
  return eventMatches(events, type);
}

async function deliver(ev: {
  id: string;
  type: string;
  accountId: string | null;
  occurredAt: Date;
  data: unknown;
}) {
  // Webhook subscriptions: queue one delivery per matching subscription
  // (idempotent on subscription + event). services/webhook-delivery.ts
  // sends them, retries failures 1 min … 12 h later and logs every
  // attempt. A queueing failure leaves the row unpublished, so the next
  // poll tries again.
  if (ev.accountId) {
    await queueWebhookDeliveries(ev);

    // Team notifications (Slack/Discord incoming webhooks) — same
    // fire-and-forget semantics; lib/team-notify.ts filters event
    // types (created + requester replies) and applies the 5s timeout.
    void notifyTeamChannels(ev).catch((e) =>
      console.error('[outbox] team notification fan-out failed', ev.id, e),
    );

    // Email is the universal inbox notification channel: every known
    // workspace member gets a direct ticket link for new tickets and
    // requester replies. Await it so the outbox row is not published
    // while delivery is still merely queued in this process.
    await notifyInboxMembers(ev).catch((e) =>
      console.error('[outbox] inbox email notification failed', ev.id, e),
    );

    // Feature wave: CSAT + automation. Both consumers filter their own
    // event types and are idempotent (processed_events claim for the
    // auto-ack; tickets.csatSentAt claim for the survey), so failures
    // never block publishing and replays never double-send.
    void maybeSendAutoResponse(ev).catch((e) =>
      console.error('[outbox] auto-response failed', ev.id, e),
    );
    void maybeSendCsatSurvey(ev).catch((e) =>
      console.error('[outbox] csat survey failed', ev.id, e),
    );
  }

  // TODO: cross-service fan-out via Huudis subscription CRUD (Huudis
  // M2). Until then this only marks the row published so events don't
  // accumulate during dev.
  await prisma.outboxEvent.update({
    where: { id: ev.id },
    data: { publishedAt: new Date() },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

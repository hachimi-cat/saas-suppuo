import { prisma } from './db.js';
import { sendCsatSurveyEmail } from './email.js';

/*
 * Feature wave: CSAT + automation — the post-resolve survey consumer.
 *
 * Called from the outbox worker on `suppuo.ticket.status_changed.v1`:
 * when a ticket lands on 'resolved', email the requester ONE rating
 * survey (😞/😐/😊 one-click links onto /t/<token>/rate).
 *
 * Send-once guard: tickets.csatSentAt — claimed atomically via
 * updateMany(csatSentAt: null), so re-resolves, event replays, and
 * concurrent workers all collapse to a single send. An existing
 * CsatResponse also short-circuits (the requester already rated, e.g.
 * via the thread-page block, before any email went out).
 */

/** 1 = 😞, 2 = 😐, 3 = 😊. */
export function isValidCsatScore(v: unknown): v is 1 | 2 | 3 {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 3;
}

export async function maybeSendCsatSurvey(ev: {
  id: string;
  type: string;
  accountId: string | null;
  data: unknown;
}): Promise<void> {
  if (ev.type !== 'suppuo.ticket.status_changed.v1' || !ev.accountId) return;
  const data = ev.data as { ticketId?: unknown; to?: unknown } | null | undefined;
  if (data?.to !== 'resolved' || typeof data.ticketId !== 'string') return;

  const ticket = await prisma.ticket.findUnique({ where: { id: data.ticketId } });
  if (!ticket || ticket.accountId !== ev.accountId) return;
  if (!ticket.requesterEmail) return; // survey is email-only in v1
  if (ticket.csatSentAt) return;

  const rated = await prisma.csatResponse.findUnique({ where: { ticketId: ticket.id } });
  if (rated) return;

  // Atomic claim: only the first worker to flip csatSentAt sends.
  const claimed = await prisma.ticket.updateMany({
    where: { id: ticket.id, csatSentAt: null },
    data: { csatSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  await sendCsatSurveyEmail({
    accountId: ticket.accountId,
    to: ticket.requesterEmail,
    ticketNumber: ticket.number,
    subject: ticket.subject,
    accessToken: ticket.accessToken,
  });
}

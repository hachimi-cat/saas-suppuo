import { prisma } from './db.js';
import { decryptCredentials } from './channel-crypto.js';

// Team notification channels — Slack + Discord incoming webhooks.
// Outbound only: the outbox worker posts a compact notification to the
// workspace's active slack_webhook / discord_webhook integrations on
// ticket-created and requester-reply events. Fire-and-forget with a
// hard 5s timeout — notification delivery must never block (or fail)
// outbox publishing.

export const TEAM_NOTIFY_PROVIDERS = ['slack_webhook', 'discord_webhook'] as const;
export type TeamNotifyProvider = (typeof TEAM_NOTIFY_PROVIDERS)[number];

const NOTIFY_TIMEOUT_MS = 5000;

// ── URL-shape validation ─────────────────────────────────────────────

/** https://hooks.slack.com/services/T…/B…/… */
export function isSlackWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === 'https:' &&
      u.hostname === 'hooks.slack.com' &&
      /^\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

/** https://discord.com/api/webhooks/<id>/<token> (discordapp.com and
 *  the ptb/canary hosts accepted too; optional /api/vNN/). */
export function isDiscordWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const hostOk =
      host === 'discord.com' ||
      host === 'discordapp.com' ||
      host === 'ptb.discord.com' ||
      host === 'canary.discord.com';
    return (
      u.protocol === 'https:' &&
      hostOk &&
      /^\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

// ── Notification formatting ──────────────────────────────────────────

export interface TeamNotification {
  kind: 'created' | 'replied';
  number: number;
  subject: string;
  requester: string;
  ticketUrl: string;
}

export function notificationTitle(n: TeamNotification): string {
  return n.kind === 'created'
    ? `New ticket #${n.number}: ${n.subject}`
    : `Customer replied on #${n.number}: ${n.subject}`;
}

/** Slack incoming-webhook payload ({ text } with Slack link markup). */
export function buildSlackPayload(n: TeamNotification): { text: string } {
  const emoji = n.kind === 'created' ? ':ticket:' : ':speech_balloon:';
  return {
    text: `${emoji} ${notificationTitle(n)}\nFrom ${n.requester} — <${n.ticketUrl}|Open #${n.number} in Suppuo>`,
  };
}

/** Discord webhook payload ({ embeds }). */
export function buildDiscordPayload(n: TeamNotification): {
  embeds: Array<{ title: string; description: string; url: string; color: number }>;
} {
  return {
    embeds: [
      {
        title: notificationTitle(n).slice(0, 256),
        description: `From ${n.requester}`,
        url: n.ticketUrl,
        color: n.kind === 'created' ? 0x22c55e : 0x6366f1,
      },
    ],
  };
}

/** Which outbox events fan out to team channels? Created always;
 *  replied only for non-internal requester messages (agents don't need
 *  notifications about their own replies). */
export function shouldNotifyTeam(type: string, data: unknown): boolean {
  if (type === 'suppuo.ticket.created.v1') return true;
  if (type === 'suppuo.ticket.replied.v1') {
    const d = data as { by?: unknown; isInternal?: unknown } | null | undefined;
    return d?.by === 'requester' && d?.isInternal !== true;
  }
  return false;
}

// ── Delivery (called from the outbox worker) ─────────────────────────

/** The "connected ✓" live-validation POST at connect time. Returns
 *  whether the provider accepted it. */
export async function sendTeamConnectedTest(
  provider: TeamNotifyProvider,
  webhookUrl: string,
): Promise<boolean> {
  const text = 'Suppuo connected ✓ — ticket notifications will arrive in this channel.';
  const payload = provider === 'slack_webhook' ? { text } : { content: text };
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fan a matching outbox event out to the workspace's active Slack /
 *  Discord integrations. Per-endpoint delivery is fire-and-forget. */
export async function notifyTeamChannels(ev: {
  type: string;
  accountId: string | null;
  data: unknown;
}): Promise<void> {
  if (!ev.accountId || !shouldNotifyTeam(ev.type, ev.data)) return;

  const integrations = await prisma.channelIntegration.findMany({
    where: {
      accountId: ev.accountId,
      provider: { in: [...TEAM_NOTIFY_PROVIDERS] },
      status: 'active',
    },
  });
  if (integrations.length === 0) return;

  const ticketId = (ev.data as { ticketId?: unknown } | null | undefined)?.ticketId;
  if (typeof ticketId !== 'string') return;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  const base = process.env.SUPPUO_PUBLIC_URL ?? 'https://suppuo.forjio.com';
  const n: TeamNotification = {
    kind: ev.type === 'suppuo.ticket.created.v1' ? 'created' : 'replied',
    number: ticket.number,
    subject: ticket.subject,
    requester:
      ticket.requesterName ??
      ticket.requesterEmail ??
      ticket.requesterPhone ??
      'Unknown requester',
    ticketUrl: `${base}/dashboard/tickets/${ticket.id}`,
  };

  for (const integ of integrations) {
    let webhookUrl: string | undefined;
    try {
      webhookUrl = decryptCredentials<{ webhookUrl?: string }>(integ.credentials).webhookUrl;
    } catch (e) {
      console.error('[team-notify] credential decrypt failed', integ.id, e);
      continue;
    }
    if (!webhookUrl) continue;
    const payload =
      integ.provider === 'slack_webhook' ? buildSlackPayload(n) : buildDiscordPayload(n);
    void postTeamWebhook(integ.id, webhookUrl, payload);
  }
}

async function postTeamWebhook(
  integrationId: string,
  url: string,
  payload: unknown,
): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[team-notify] ${integrationId} → HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`[team-notify] ${integrationId} failed`, e);
  }
}

/**
 * The event catalogue — every event type Suppuo delivers to webhook
 * subscriptions, in one place. GET /api/v1/webhook-subscriptions/event-types
 * serves it, the dashboard's event picker renders from that response, and
 * copy/docs/webhooks.md documents the same list (a test keeps them equal).
 *
 * A subscription's `events` may hold these types, `*` (everything) or a
 * prefix ending in `*` (`suppuo.ticket.*`).
 */
export const EVENT_TYPES = [
  {
    type: 'suppuo.ticket.created.v1',
    description: 'A new ticket arrived (form, email, WhatsApp, Telegram, the requester portal, or logged by an agent).',
  },
  {
    type: 'suppuo.ticket.replied.v1',
    description: 'A message was added to a ticket: an agent reply or internal note, or a requester follow-up (email, chat, the public ticket page, the requester portal).',
  },
  {
    type: 'suppuo.ticket.status_changed.v1',
    description: 'A ticket moved between open / pending / resolved / closed.',
  },
  {
    type: 'suppuo.billing.subscribed.v1',
    description: 'A paid plan was activated on the workspace.',
  },
  {
    type: 'suppuo.webhook_subscription.disabled.v1',
    description: 'Suppuo switched off one of your webhook subscriptions because it kept failing.',
  },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]['type'];

/** `*` matches every type, `suppuo.ticket.*` every type with that prefix,
 *  anything else only the exact type. */
export function eventMatches(patterns: unknown, type: string): boolean {
  if (!Array.isArray(patterns)) return false;
  return patterns.some((p) => {
    if (typeof p !== 'string' || p.length === 0) return false;
    if (p === '*' || p === type) return true;
    return p.endsWith('*') && type.startsWith(p.slice(0, -1));
  });
}

import crypto from 'node:crypto';

// Pure ticket-state helpers — unit-tested, no IO.

export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export function isTicketStatus(v: unknown): v is TicketStatus {
  return typeof v === 'string' && (TICKET_STATUSES as readonly string[]).includes(v);
}

export function isTicketPriority(v: unknown): v is TicketPriority {
  return typeof v === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(v);
}

/**
 * Status after a new message lands:
 *  - requester replies → the ball is in the agents' court → `open`
 *    (re-opens resolved tickets; closed stays closed — requester
 *    replies on a closed ticket surface as open again too, by design:
 *    a customer who writes back needs eyes on it).
 *  - agent PUBLIC reply → waiting on the requester → `pending`.
 *  - agent INTERNAL note → no transition.
 */
export function nextStatusOnMessage(
  current: TicketStatus,
  authorType: 'agent' | 'requester',
  isInternal: boolean,
): TicketStatus {
  if (authorType === 'requester') return 'open';
  if (isInternal) return current;
  if (current === 'closed' || current === 'resolved') return current;
  return 'pending';
}

/** Opaque requester status-link token (/t/<token>). */
export function generateAccessToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

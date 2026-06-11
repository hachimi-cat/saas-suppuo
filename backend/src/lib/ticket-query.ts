import { validation } from './http.js';

/*
 * Pure helpers for the inbox list surface — tag normalization + the
 * list-filter where-clause builder. No IO; unit-tested in
 * __tests__/ticket-query.test.ts.
 */

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 40;

/**
 * Normalize a tag list: trim, lowercase, drop empties, dedupe
 * (order-preserving). Throws VALIDATION_ERROR when a tag exceeds
 * MAX_TAG_LENGTH or more than MAX_TAGS remain after dedupe.
 */
export function normalizeTags(input: string[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) {
      throw validation(`tags must be at most ${MAX_TAG_LENGTH} characters`, 'tags');
    }
    if (!out.includes(tag)) out.push(tag);
  }
  if (out.length > MAX_TAGS) {
    throw validation(`at most ${MAX_TAGS} tags per ticket`, 'tags');
  }
  return out;
}

export interface TicketListFilters {
  accountId: string;
  status?: string; // 'all' | a TicketStatus
  /** Huudis sub | 'me' (resolved against viewerSub) | 'unassigned'. */
  assignee?: string;
  tag?: string;
  channel?: string;
  priority?: string;
  /** Free-text search across subject/requester/message bodies. */
  q?: string;
  /** The caller's own sub — resolves assignee='me'. */
  viewerSub?: string;
}

/** Prisma-shaped where clause (kept structural so it stays pure +
 *  testable without importing the generated client). */
export type TicketWhere = Record<string, unknown>;

/** Build the Prisma `where` for the inbox list from query filters. */
export function buildTicketListWhere(f: TicketListFilters): TicketWhere {
  const where: TicketWhere = { accountId: f.accountId };

  if (f.status && f.status !== 'all') where.status = f.status;
  if (f.channel) where.channel = f.channel;
  if (f.priority) where.priority = f.priority;
  if (f.tag) where.tags = { has: f.tag.trim().toLowerCase() };

  if (f.assignee) {
    if (f.assignee === 'unassigned') {
      where.assigneeSub = null;
    } else if (f.assignee === 'me') {
      // No viewer sub (e.g. api-key caller without one) → match nothing
      // rather than leaking the whole inbox.
      where.assigneeSub = f.viewerSub ?? '__none__';
    } else {
      where.assigneeSub = f.assignee;
    }
  }

  const q = f.q?.trim();
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const };
    where.OR = [
      { subject: contains },
      { requesterEmail: contains },
      { requesterName: contains },
      { messages: { some: { body: contains } } },
    ];
  }

  return where;
}

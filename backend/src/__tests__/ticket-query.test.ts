import { describe, it, expect } from 'vitest';
import {
  normalizeTags,
  buildTicketListWhere,
  MAX_TAGS,
  MAX_TAG_LENGTH,
} from '../lib/ticket-query.js';
import { ApiError } from '../lib/http.js';

describe('normalizeTags', () => {
  it('trims, lowercases, drops empties, dedupes (order-preserving)', () => {
    expect(normalizeTags(['  Billing ', 'URGENT', 'billing', '', '   ', 'Vip'])).toEqual([
      'billing',
      'urgent',
      'vip',
    ]);
  });

  it('accepts the empty list (clears tags)', () => {
    expect(normalizeTags([])).toEqual([]);
  });

  it('accepts exactly MAX_TAGS tags', () => {
    const tags = Array.from({ length: MAX_TAGS }, (_, i) => `tag-${i}`);
    expect(normalizeTags(tags)).toHaveLength(MAX_TAGS);
  });

  it('rejects more than MAX_TAGS tags after dedupe', () => {
    const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag-${i}`);
    expect(() => normalizeTags(tags)).toThrowError(ApiError);
    try {
      normalizeTags(tags);
    } catch (e) {
      expect((e as ApiError).code).toBe('VALIDATION_ERROR');
      expect((e as ApiError).param).toBe('tags');
    }
  });

  it('does not reject when duplicates collapse under the cap', () => {
    const tags = [...Array.from({ length: MAX_TAGS }, (_, i) => `tag-${i}`), 'TAG-0', ' tag-1 '];
    expect(normalizeTags(tags)).toHaveLength(MAX_TAGS);
  });

  it('rejects tags longer than MAX_TAG_LENGTH (after trim)', () => {
    expect(() => normalizeTags(['x'.repeat(MAX_TAG_LENGTH + 1)])).toThrowError(ApiError);
    expect(normalizeTags([` ${'x'.repeat(MAX_TAG_LENGTH)} `])).toEqual([
      'x'.repeat(MAX_TAG_LENGTH),
    ]);
  });
});

describe('buildTicketListWhere', () => {
  const base = { accountId: 'acc_1' };

  it('always scopes to the account', () => {
    expect(buildTicketListWhere(base)).toEqual({ accountId: 'acc_1' });
  });

  it("status 'all' adds no status clause; concrete statuses do", () => {
    expect(buildTicketListWhere({ ...base, status: 'all' })).toEqual({ accountId: 'acc_1' });
    expect(buildTicketListWhere({ ...base, status: 'open' })).toMatchObject({ status: 'open' });
  });

  it('passes channel + priority through', () => {
    expect(buildTicketListWhere({ ...base, channel: 'whatsapp', priority: 'urgent' })).toMatchObject({
      channel: 'whatsapp',
      priority: 'urgent',
    });
  });

  it('tag filter normalizes and uses array has', () => {
    expect(buildTicketListWhere({ ...base, tag: ' Billing ' })).toMatchObject({
      tags: { has: 'billing' },
    });
  });

  it("assignee 'unassigned' → assigneeSub null", () => {
    expect(buildTicketListWhere({ ...base, assignee: 'unassigned' })).toMatchObject({
      assigneeSub: null,
    });
  });

  it("assignee 'me' resolves to the viewer sub", () => {
    expect(buildTicketListWhere({ ...base, assignee: 'me', viewerSub: 'usr_42' })).toMatchObject({
      assigneeSub: 'usr_42',
    });
  });

  it("assignee 'me' without a viewer sub matches nothing (no leak)", () => {
    const where = buildTicketListWhere({ ...base, assignee: 'me' });
    expect(where.assigneeSub).toBe('__none__');
  });

  it('explicit sub passes through', () => {
    expect(buildTicketListWhere({ ...base, assignee: 'usr_99' })).toMatchObject({
      assigneeSub: 'usr_99',
    });
  });

  it('q builds a case-insensitive OR across subject/requester/messages', () => {
    const where = buildTicketListWhere({ ...base, q: 'refund' });
    const contains = { contains: 'refund', mode: 'insensitive' };
    expect(where.OR).toEqual([
      { subject: contains },
      { requesterEmail: contains },
      { requesterName: contains },
      { messages: { some: { body: contains } } },
    ]);
  });

  it('blank q adds no OR clause', () => {
    expect(buildTicketListWhere({ ...base, q: '   ' }).OR).toBeUndefined();
  });

  it('filters compose', () => {
    const where = buildTicketListWhere({
      ...base,
      status: 'open',
      assignee: 'unassigned',
      tag: 'vip',
      channel: 'email',
      priority: 'high',
      q: 'invoice',
    });
    expect(where).toMatchObject({
      accountId: 'acc_1',
      status: 'open',
      assigneeSub: null,
      tags: { has: 'vip' },
      channel: 'email',
      priority: 'high',
    });
    expect(Array.isArray(where.OR)).toBe(true);
  });
});

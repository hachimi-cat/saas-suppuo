import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/*
 * Public ticket endpoint hardening (2026-06-16) — the open, unauthenticated
 * POST /api/v1/public/tickets is the widget + hosted-form submit path, so it
 * carries its own spam defenses: a hidden honeypot field (`company`) and a
 * real per-IP rate limit (the shared rateLimit() middleware is header-only).
 * These tests pin both behaviors with prisma + email mocked.
 */

const created: Array<Record<string, unknown>> = [];

const db = {
  ticket: {
    aggregate: async () => ({ _max: { number: 0 } }),
    create: async (args: { data: Record<string, unknown> }) => {
      const row = { ...args.data, createdAt: new Date() };
      created.push(row);
      return row;
    },
  },
  ticketMessage: {
    create: async (args: { data: Record<string, unknown> }) => args.data,
  },
  outboxEvent: {
    create: async (args: { data: Record<string, unknown> }) => args.data,
  },
};

const prismaMock = {
  ...db,
  $transaction: async <T>(fn: (tx: typeof db) => Promise<T>): Promise<T> => fn(db),
};

vi.mock('../lib/db.js', () => ({ prisma: prismaMock }));
vi.mock('../lib/email.js', () => ({
  sendTicketReceivedEmail: async () => undefined,
}));

const { createApp } = await import('../app.js');
const app = createApp();

// A valid Huudis-workspace account id (ULID form).
const ACC = 'acc_01KPHFWPCNT7EE9VEKV2G7AFXE';

function submit(body: Record<string, unknown>) {
  return request(app).post('/api/v1/public/tickets').send(body);
}

beforeEach(() => {
  created.length = 0;
});

describe('public ticket honeypot', () => {
  it('silently drops a bot submission (honeypot filled) without creating a ticket', async () => {
    const res = await submit({
      accountId: ACC,
      subject: 'Cheap watches',
      body: 'spam spam spam',
      email: 'bot@spam.test',
      company: 'Acme Spam Co', // honeypot — a human never fills this
    });
    // Pretend it worked so the bot doesn't retry/probe…
    expect(res.status).toBe(201);
    // …but nothing was persisted.
    expect(created).toHaveLength(0);
  });

  it('accepts a normal submission (honeypot empty) and creates the ticket', async () => {
    const res = await submit({
      accountId: ACC,
      subject: 'Real question',
      body: 'How do I reset my password?',
      email: 'human@example.com',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(created).toHaveLength(1);
  });
});

describe('public ticket per-IP rate limit', () => {
  it('429s a flood of submissions from one IP after the soft limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await submit({
        accountId: ACC,
        subject: `flood ${i}`,
        body: 'rapid fire',
        email: `flood${i}@example.com`,
      });
      statuses.push(res.status);
    }
    // At least one request was rate-limited…
    expect(statuses).toContain(429);
    // …and once limited, it stays limited (the tail is all 429).
    const firstLimited = statuses.indexOf(429);
    expect(statuses.slice(firstLimited).every((s) => s === 429)).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/*
 * Requester portal — the authenticated "my tickets" API + the stateless
 * requester tokens. Covers BOTH auth paths (trusted service header for
 * the embedded center; magic-link session cookie for the hosted portal)
 * and the hard requirement that a requester only ever sees their own
 * (accountId, email) tickets.
 */

process.env.SUPPUO_SERVICE_SECRET = 'test-service-secret';
process.env.SUPPUO_REQUESTER_SECRET = 'test-requester-secret';

const ACC = 'acc_01KPHFWPCNT7EE9VEKV2G7AFXE';
const OTHER = 'acc_01KPHFWPDAG858RM5EPKENXVJY';
const ME = 'me@example.com';

interface T {
  id: string;
  accountId: string;
  number: number;
  subject: string;
  status: string;
  requesterEmail: string | null;
  requesterName: string | null;
  accessToken: string;
  createdAt: Date;
  lastMessageAt: Date;
}

let tickets: T[] = [];
const messages: Array<Record<string, unknown>> = [];

function whereMatch(t: T, w: Record<string, unknown>): boolean {
  if (w.accountId && t.accountId !== w.accountId) return false;
  if (w.requesterEmail && t.requesterEmail !== w.requesterEmail) return false;
  if (typeof w.number === 'number' && t.number !== w.number) return false;
  if (w.status && typeof w.status === 'object' && 'in' in (w.status as object)) {
    if (!(w.status as { in: string[] }).in.includes(t.status)) return false;
  }
  return true;
}

const db = {
  ticket: {
    findMany: async (a: { where: Record<string, unknown> }) =>
      tickets.filter((t) => whereMatch(t, a.where)),
    findFirst: async (a: { where: Record<string, unknown> }) =>
      ({ ...tickets.find((t) => whereMatch(t, a.where)), messages: [] }.id
        ? { ...tickets.find((t) => whereMatch(t, a.where))!, messages: [] }
        : null),
    count: async (a: { where: Record<string, unknown> }) =>
      tickets.filter((t) => whereMatch(t, a.where)).length,
    aggregate: async (a: { where: Record<string, unknown> }) => ({
      _max: { number: Math.max(0, ...tickets.filter((t) => whereMatch(t, a.where)).map((t) => t.number)) },
    }),
    create: async (a: { data: T }) => {
      const t = { ...a.data, createdAt: new Date(), lastMessageAt: new Date() };
      tickets.push(t);
      return t;
    },
    update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
      const t = tickets.find((x) => x.id === a.where.id)!;
      Object.assign(t, a.data);
      return t;
    },
  },
  ticketMessage: {
    create: async (a: { data: Record<string, unknown> }) => {
      messages.push(a.data);
      return { ...a.data, createdAt: new Date() };
    },
  },
  outboxEvent: { create: async (a: { data: Record<string, unknown> }) => a.data },
};

vi.mock('../lib/db.js', () => ({
  prisma: { ...db, $transaction: async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db) },
}));
vi.mock('../lib/email.js', () => ({
  sendTicketReceivedEmail: async () => undefined,
  sendRequesterLoginEmail: async () => undefined,
}));

const { createApp } = await import('../app.js');
const { issueRequesterToken, verifyRequesterToken, REQUESTER_COOKIE } = await import(
  '../lib/requester-token.js'
);
const app = createApp();

const svc = (req: request.Test) =>
  req
    .set('X-Suppuo-Service', 'test-service-secret')
    .set('X-Suppuo-Account', ACC)
    .set('X-Suppuo-Requester', ME);

beforeEach(() => {
  tickets = [
    { id: 't1', accountId: ACC, number: 1, subject: 'mine open', status: 'open', requesterEmail: ME, requesterName: null, accessToken: 'tok1', createdAt: new Date(), lastMessageAt: new Date() },
    { id: 't2', accountId: ACC, number: 2, subject: 'mine resolved', status: 'resolved', requesterEmail: ME, requesterName: null, accessToken: 'tok2', createdAt: new Date(), lastMessageAt: new Date() },
    { id: 't3', accountId: ACC, number: 3, subject: 'someone else', status: 'open', requesterEmail: 'other@x.com', requesterName: null, accessToken: 'tok3', createdAt: new Date(), lastMessageAt: new Date() },
    { id: 't4', accountId: OTHER, number: 1, subject: 'other workspace', status: 'open', requesterEmail: ME, requesterName: null, accessToken: 'tok4', createdAt: new Date(), lastMessageAt: new Date() },
  ];
  messages.length = 0;
});

describe('requester tokens', () => {
  it('round-trips login → session and rejects wrong purpose / tampering', () => {
    const login = issueRequesterToken(ACC, ME, 'login');
    expect(verifyRequesterToken(login, 'login')?.email).toBe(ME);
    expect(verifyRequesterToken(login, 'session')).toBeNull(); // purpose mismatch
    expect(verifyRequesterToken(login + 'x', 'login')).toBeNull(); // tampered
  });
});

describe('requester API auth', () => {
  it('401s with no credential', async () => {
    const res = await request(app).get('/api/v1/requester/tickets');
    expect(res.status).toBe(401);
  });

  it('401s on a bad service secret', async () => {
    const res = await request(app)
      .get('/api/v1/requester/tickets')
      .set('X-Suppuo-Service', 'wrong')
      .set('X-Suppuo-Account', ACC)
      .set('X-Suppuo-Requester', ME);
    expect(res.status).toBe(401);
  });

  it('accepts a valid session cookie', async () => {
    const session = issueRequesterToken(ACC, ME, 'session');
    const res = await request(app)
      .get('/api/v1/requester/tickets')
      .set('Cookie', `${REQUESTER_COOKIE}=${session}`);
    expect(res.status).toBe(200);
    expect(res.body.data.counts).toEqual({ open: 1, resolved: 1 });
  });
});

describe('requester scoping (service path)', () => {
  it('lists only MY tickets in THIS workspace', async () => {
    const res = await svc(request(app).get('/api/v1/requester/tickets'));
    expect(res.status).toBe(200);
    const subjects = res.body.data.tickets.map((t: { subject: string }) => t.subject).sort();
    expect(subjects).toEqual(['mine open', 'mine resolved']); // not t3 (other email) or t4 (other acc)
    expect(res.body.data.counts).toEqual({ open: 1, resolved: 1 });
  });

  it('filters by status group', async () => {
    const res = await svc(request(app).get('/api/v1/requester/tickets?status=resolved'));
    expect(res.body.data.tickets.map((t: { number: number }) => t.number)).toEqual([2]);
  });

  it('cannot open someone else\'s ticket number', async () => {
    const res = await svc(request(app).get('/api/v1/requester/tickets/3')); // t3 is other@x.com
    expect(res.status).toBe(404);
  });

  it('creates a ticket bound to my email', async () => {
    const res = await svc(request(app).post('/api/v1/requester/tickets')).send({
      subject: 'help me',
      body: 'a question',
    });
    expect(res.status).toBe(201);
    const created = tickets.find((t) => t.subject === 'help me');
    expect(created?.requesterEmail).toBe(ME);
    expect(created?.accountId).toBe(ACC);
  });
});

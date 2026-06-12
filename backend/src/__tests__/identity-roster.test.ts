import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'node:crypto';

/*
 * Identity roster — the thin SSO capture closing the admin-CRM blind
 * spot (customers showed `email: null, name: acc_…` because this
 * stateless-Huudis product keeps no local identity). Covers:
 *
 *   1. requireAuth (BFF Path 0) upserts identity + ACTIVE-account
 *      membership, throttled to ≤1 write per (sub, account) per hour.
 *   2. The workspace-override cookie captures membership for the
 *      workspace actually acted under (multi-workspace).
 *   3. auth-config's `onAuthenticated` login hook records the personal
 *      derived accountId + the login-time workspace snapshot, and
 *      skips admin sessions.
 *   4. admin-crm /customers joins the roster (earliest member = owner)
 *      and falls back to accountId-only rows when nothing is known.
 */

vi.mock('../lib/db.js', () => ({
  prisma: {
    apiKey: {},
    rosterIdentity: { upsert: vi.fn() },
    rosterMembership: { upsert: vi.fn(), findMany: vi.fn() },
    ticket: { groupBy: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { authConfig } from '../auth-config.js';
import { clearRosterThrottle } from '../lib/identity-roster.js';
import adminCrmRouter from '../routes/admin-crm.js';

const db = prisma as unknown as {
  rosterIdentity: { upsert: ReturnType<typeof vi.fn> };
  rosterMembership: { upsert: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  ticket: { groupBy: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};

const SESSION_COOKIE = 'suppuo_session';
const OVERRIDE_COOKIE = 'suppuo_active_workspace';

function mintSession(overrides: Record<string, unknown> = {}): string {
  return authConfig.codec.encode({
    accountId: 'acc_personal',
    email: 'agent@example.com',
    name: 'Test Agent',
    huudisSub: 'huudis|u1',
    role: 'merchant',
    accountIds: ['acc_personal', 'wks_team'],
    ...overrides,
  });
}

function makeApp() {
  const app = express();
  app.get('/whoami', requireAuth, (req, res) => {
    res.json({ accountId: req.auth?.accountId });
  });
  return app;
}

/** Drain the fire-and-forget roster write (a few microtask/IO ticks). */
async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  clearRosterThrottle();
  db.rosterIdentity.upsert.mockReset().mockResolvedValue({});
  db.rosterMembership.upsert.mockReset().mockResolvedValue({});
  db.rosterMembership.findMany.mockReset().mockResolvedValue([]);
  db.ticket.groupBy.mockReset();
  db.ticket.count.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('identity roster — capture in requireAuth (BFF Path 0)', () => {
  it('upserts identity + membership for the active account', async () => {
    const res = await request(makeApp())
      .get('/whoami')
      .set('Cookie', `${SESSION_COOKIE}=${mintSession()}`);
    expect(res.status).toBe(200);
    await flush();

    expect(db.rosterIdentity.upsert).toHaveBeenCalledTimes(1);
    const idArgs = db.rosterIdentity.upsert.mock.calls[0]![0];
    expect(idArgs.where).toEqual({ huudisSub: 'huudis|u1' });
    expect(idArgs.create.email).toBe('agent@example.com');
    expect(idArgs.create.name).toBe('Test Agent');
    expect(idArgs.create.id).toMatch(/^rst_/);
    expect(idArgs.update.email).toBe('agent@example.com');

    expect(db.rosterMembership.upsert).toHaveBeenCalledTimes(1);
    const mArgs = db.rosterMembership.upsert.mock.calls[0]![0];
    expect(mArgs.where).toEqual({
      huudisSub_accountId: { huudisSub: 'huudis|u1', accountId: 'acc_personal' },
    });
    expect(mArgs.create.id).toMatch(/^rmb_/);
  });

  it('throttles: a second request within the hour writes nothing', async () => {
    const app = makeApp();
    const cookie = `${SESSION_COOKIE}=${mintSession()}`;
    await request(app).get('/whoami').set('Cookie', cookie);
    await flush();
    expect(db.rosterIdentity.upsert).toHaveBeenCalledTimes(1);

    await request(app).get('/whoami').set('Cookie', cookie);
    await flush();
    expect(db.rosterIdentity.upsert).toHaveBeenCalledTimes(1);
    expect(db.rosterMembership.upsert).toHaveBeenCalledTimes(1);
  });

  it('captures the ACTIVE workspace when the override cookie is set (multi-workspace)', async () => {
    const res = await request(makeApp())
      .get('/whoami')
      .set('Cookie', `${SESSION_COOKIE}=${mintSession()}; ${OVERRIDE_COOKIE}=wks_team`);
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe('wks_team');
    await flush();

    const mArgs = db.rosterMembership.upsert.mock.calls[0]![0];
    expect(mArgs.where.huudisSub_accountId.accountId).toBe('wks_team');
  });

  it('a roster DB failure never breaks the request', async () => {
    db.rosterIdentity.upsert.mockRejectedValue(new Error('db down'));
    const res = await request(makeApp())
      .get('/whoami')
      .set('Cookie', `${SESSION_COOKIE}=${mintSession()}`);
    expect(res.status).toBe(200);
    await flush();
  });
});

describe('identity roster — onAuthenticated login hook', () => {
  const hookCtx = {
    account: { id: 'huudis|u9', email: 'owner@example.com', name: 'Owner' },
    tokens: { access_token: 'at', refresh_token: 'rt' },
    accountIds: ['wks_alpha', 'wks_beta'],
    via: 'password' as const,
  };

  it('records the derived personal accountId + the workspace snapshot', async () => {
    await authConfig.onAuthenticated!({ ...hookCtx, role: 'merchant' });
    await flush();

    expect(db.rosterIdentity.upsert).toHaveBeenCalledTimes(1);
    expect(db.rosterIdentity.upsert.mock.calls[0]![0].where).toEqual({ huudisSub: 'huudis|u9' });

    const derived = `acc_${crypto.createHash('sha256').update('huudis|u9').digest('hex').slice(0, 24)}`;
    const seen = db.rosterMembership.upsert.mock.calls.map(
      (c) =>
        (c[0] as { where: { huudisSub_accountId: { accountId: string } } }).where
          .huudisSub_accountId.accountId,
    );
    expect(seen).toEqual([derived, 'wks_alpha', 'wks_beta']);
  });

  it('skips admin sessions — they are not CRM customers', async () => {
    await authConfig.onAuthenticated!({ ...hookCtx, role: 'admin' });
    await flush();
    expect(db.rosterIdentity.upsert).not.toHaveBeenCalled();
    expect(db.rosterMembership.upsert).not.toHaveBeenCalled();
  });
});

describe('identity roster — admin CRM /customers join', () => {
  it('resolves email + name from the earliest-seen member, falls back to accountId', async () => {
    db.ticket.groupBy.mockResolvedValue([
      {
        accountId: 'acc_known',
        _count: { _all: 3 },
        _min: { createdAt: new Date('2026-06-01') },
        _max: { lastMessageAt: new Date('2026-06-10') },
      },
      {
        accountId: 'acc_unknown',
        _count: { _all: 1 },
        _min: { createdAt: new Date('2026-06-02') },
        _max: { lastMessageAt: new Date('2026-06-03') },
      },
    ]);
    db.ticket.count.mockResolvedValue(0);
    // findMany is ordered createdAt asc — the FIRST member per account wins.
    db.rosterMembership.findMany.mockResolvedValue([
      {
        accountId: 'acc_known',
        createdAt: new Date('2026-06-01'),
        identity: { email: 'owner@example.com', name: 'Owner' },
      },
      {
        accountId: 'acc_known',
        createdAt: new Date('2026-06-05'),
        identity: { email: 'late@example.com', name: 'Late Joiner' },
      },
    ]);

    const app = express();
    app.use('/admin/crm', adminCrmRouter);
    const res = await request(app).get('/admin/crm/customers');
    expect(res.status).toBe(200);

    const customers = res.body.data.customers as Array<{
      id: string;
      email: string | null;
      name: string;
    }>;
    const known = customers.find((c) => c.id === 'acc_known')!;
    expect(known.email).toBe('owner@example.com');
    expect(known.name).toBe('Owner');

    const unknown = customers.find((c) => c.id === 'acc_unknown')!;
    expect(unknown.email).toBeNull();
    expect(unknown.name).toBe('acc_unknown');

    // The roster query was scoped to the grouped accountIds.
    expect(db.rosterMembership.findMany.mock.calls[0]![0].where.accountId.in).toEqual([
      'acc_known',
      'acc_unknown',
    ]);
  });
});

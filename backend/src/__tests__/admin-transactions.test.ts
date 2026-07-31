import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/*
 * The Transactions adapter.
 *
 * Suppuo bills flat monthly tiers through Plugipay and keeps no
 * per-payment table, so these rows are RECURRING CHARGES rather than
 * payments that landed on a date. That is unusual enough that the page
 * carries a note saying so — and these tests pin the note along with the
 * arithmetic, because a ledger whose dates mean something different from
 * every other product's is worse than no ledger at all.
 */

const findMany = vi.fn();
vi.mock('../lib/db.js', () => ({ prisma: { billingSubscription: { findMany } } }));

vi.mock('../middleware/admin-guard.js', () => ({
  adminGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const NOW = new Date('2026-07-31T00:00:00Z');

function sub(over: Record<string, unknown> = {}) {
  return {
    id: 'bsub_1',
    accountId: 'acc_a',
    tier: 'growth',
    currentPeriodEnd: new Date('2026-08-15T00:00:00Z'),
    updatedAt: NOW,
    ...over,
  };
}

async function get() {
  const { createApp } = await import('../app.js');
  return request(createApp()).get('/api/v1/admin/transactions');
}

beforeEach(() => {
  vi.resetModules();
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe('GET /api/v1/admin/transactions', () => {
  it('queries only ACTIVE subscriptions', async () => {
    await get();
    // A canceled or past-due row still carries its tier; honouring it
    // would keep churned revenue on the board forever.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'active' }) }),
    );
  });

  it('excludes free-tier workspaces rather than listing them at zero', async () => {
    // A page of Rp 0 rows buries the paying ones it exists to show.
    findMany.mockResolvedValue([sub(), sub({ id: 'bsub_2', tier: 'free' })]);
    const body = (await get()).body.data;
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].id).toBe('bsub_1');
    expect(body.summary.count).toBe(1);
  });

  it('reports the tier price in MINOR units', async () => {
    findMany.mockResolvedValue([sub({ tier: 'starter' })]);
    const body = (await get()).body.data;
    // 99_000 rupiah — carried as minor units, scaled exactly once.
    expect(body.rows[0].amountMinor).toBe(9_900_000);
    expect(body.summary.grossMinor).toBe(9_900_000);
  });

  it('dates each row by when its period ENDS, not by a payment that never happened', async () => {
    findMany.mockResolvedValue([sub()]);
    const body = (await get()).body.data;
    expect(body.rows[0].at).toBe('2026-08-15T00:00:00.000Z');
    expect(body.rows[0].kind).toBe('subscription');
  });

  it('falls back to updatedAt when a subscription has no period end', async () => {
    findMany.mockResolvedValue([sub({ currentPeriodEnd: null })]);
    expect((await get()).body.data.rows[0].at).toBe(NOW.toISOString());
  });

  it('says on screen that these are charges, not a payment ledger', async () => {
    // Without this the dates look wrong and an operator has to go and
    // find out why. The note is part of the contract, not decoration.
    const body = (await get()).body.data;
    expect(body.note).toMatch(/not a payment ledger/i);
  });

  it('counts one recurring charge per paying workspace', async () => {
    findMany.mockResolvedValue([sub(), sub({ id: 'bsub_2', accountId: 'acc_b' })]);
    const { count, payers } = (await get()).body.data.summary;
    expect(count).toBe(2);
    expect(payers).toBe(2);
  });
});

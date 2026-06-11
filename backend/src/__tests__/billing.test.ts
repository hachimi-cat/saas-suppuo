import { describe, it, expect, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import {
  BILLING_TIERS,
  TIER_DEFS,
  isBillingTier,
  isPaidTier,
  tierDef,
  parseCheckoutMetadata,
  applyCheckoutCompleted,
  type BillingDb,
} from '../lib/billing.js';

describe('tier definitions', () => {
  it('ships exactly the 4 public pricing tiers, in order', () => {
    expect(BILLING_TIERS).toEqual(['gratis', 'warung', 'toko', 'bisnis']);
    expect(TIER_DEFS.map((t) => t.id)).toEqual(['gratis', 'warung', 'toko', 'bisnis']);
  });

  it('prices match the locked /pricing page exactly (whole IDR / month)', () => {
    expect(tierDef('gratis').priceIdr).toBe(0);
    expect(tierDef('warung').priceIdr).toBe(99_000);
    expect(tierDef('toko').priceIdr).toBe(299_000);
    expect(tierDef('bisnis').priceIdr).toBe(599_000);
  });

  it('gratis is the only free tier', () => {
    expect(isPaidTier('gratis')).toBe(false);
    expect(isPaidTier('warung')).toBe(true);
    expect(isPaidTier('toko')).toBe(true);
    expect(isPaidTier('bisnis')).toBe(true);
  });

  it('every tier has a blurb + features', () => {
    for (const t of TIER_DEFS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(0);
      expect(t.features.length).toBeGreaterThan(0);
    }
  });

  it('guards tier names', () => {
    expect(isBillingTier('toko')).toBe(true);
    expect(isBillingTier('enterprise')).toBe(false);
    expect(isBillingTier(42)).toBe(false);
  });
});

describe('parseCheckoutMetadata', () => {
  it('accepts {accountId, tier} for a paid tier', () => {
    expect(parseCheckoutMetadata({ accountId: 'acc_1', tier: 'warung' })).toEqual({
      accountId: 'acc_1',
      tier: 'warung',
    });
  });

  it('rejects gratis (never purchased), unknown tiers, and missing accountId', () => {
    expect(parseCheckoutMetadata({ accountId: 'acc_1', tier: 'gratis' })).toBeNull();
    expect(parseCheckoutMetadata({ accountId: 'acc_1', tier: 'platinum' })).toBeNull();
    expect(parseCheckoutMetadata({ tier: 'toko' })).toBeNull();
    expect(parseCheckoutMetadata({ accountId: '  ', tier: 'toko' })).toBeNull();
    expect(parseCheckoutMetadata(null)).toBeNull();
    expect(parseCheckoutMetadata(undefined)).toBeNull();
  });
});

// ── webhook apply: idempotency on the checkout session id ──────────

function fakeDb(existingSessionIds: Set<string>) {
  const upsert = vi.fn(async (args: { create: { id: string } }) => ({ id: args.create.id }));
  const outboxCreate = vi.fn(async () => ({}));
  const tx = {
    billingSubscription: {
      findFirst: vi.fn(async (args: { where: { plugipayCheckoutSessionId: string } }) =>
        existingSessionIds.has(args.where.plugipayCheckoutSessionId) ? { id: 'bsub_existing' } : null,
      ),
      upsert,
    },
    outboxEvent: { create: outboxCreate },
  } as unknown as Prisma.TransactionClient;
  const db: BillingDb = {
    $transaction: (fn) => fn(tx),
  };
  return { db, upsert, outboxCreate };
}

describe('applyCheckoutCompleted', () => {
  const input = { sessionId: 'cs_abc', accountId: 'acc_1', tier: 'toko' as const };

  it('applies a fresh session: upserts the subscription + writes the outbox event', async () => {
    const { db, upsert, outboxCreate } = fakeDb(new Set());
    await expect(applyCheckoutCompleted(db, input)).resolves.toBe('applied');

    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0]![0] as unknown as {
      where: { accountId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.where).toEqual({ accountId: 'acc_1' });
    expect(args.create.id).toMatch(/^bsub_/);
    expect(args.create.tier).toBe('toko');
    expect(args.create.status).toBe('active');
    expect(args.create.plugipayCheckoutSessionId).toBe('cs_abc');
    const end = args.create.currentPeriodEnd as Date;
    const days = (end.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(args.update.tier).toBe('toko');

    expect(outboxCreate).toHaveBeenCalledTimes(1);
    const evt = (outboxCreate.mock.calls[0] as unknown[])[0] as {
      data: { type: string; accountId: string; data: Record<string, unknown> };
    };
    expect(evt.data.type).toBe('suppuo.billing.subscribed.v1');
    expect(evt.data.accountId).toBe('acc_1');
    expect(evt.data.data.plugipayCheckoutSessionId).toBe('cs_abc');
  });

  it('is idempotent: a replayed session id is a no-op (no upsert, no outbox)', async () => {
    const { db, upsert, outboxCreate } = fakeDb(new Set(['cs_abc']));
    await expect(applyCheckoutCompleted(db, input)).resolves.toBe('duplicate');
    expect(upsert).not.toHaveBeenCalled();
    expect(outboxCreate).not.toHaveBeenCalled();
  });
});

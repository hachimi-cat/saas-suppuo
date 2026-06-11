import type { Prisma } from '@prisma/client';
import { newId } from './ids.js';
import { writeOutbox } from './outbox.js';

/*
 * Billing domain — tier definitions + the webhook apply step.
 *
 * The tier table mirrors frontend/src/app/(marketing)/pricing/page.tsx
 * EXACTLY (per-workspace flat IDR pricing, locked). Early access: paid
 * tiers are purchasable and recorded truthfully, but nothing is
 * enforced — every workspace gets Toko-level features free until
 * launch. Do NOT add limit enforcement here in v1.
 */

export const BILLING_TIERS = ['gratis', 'warung', 'toko', 'bisnis'] as const;
export type BillingTier = (typeof BILLING_TIERS)[number];

export const SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface TierDef {
  id: BillingTier;
  name: string;
  /** Whole rupiah per month. 0 = free. */
  priceIdr: number;
  blurb: string;
  features: string[];
}

export const TIER_DEFS: readonly TierDef[] = [
  {
    id: 'gratis',
    name: 'Gratis',
    priceIdr: 0,
    blurb: 'For trying Suppuo out, or a one-person support desk.',
    features: [
      '2 agents',
      '100 tickets / month',
      'Inbox — statuses, priorities, assignment',
      'Internal notes',
      '10 canned replies',
      'Hosted support form + status links (Suppuo branding)',
      'Email notifications',
      'Community support',
    ],
  },
  {
    id: 'warung',
    name: 'Warung',
    priceIdr: 99_000,
    blurb: 'For small teams running real support every day.',
    features: [
      '3 agents',
      'Unlimited tickets',
      'Unlimited canned replies',
      'Hosted form + status links — no Suppuo branding',
      'WhatsApp channel (beta) — 1 number · 500 msgs/bln',
      'WA overage Rp 150/msg',
      'Email support',
    ],
  },
  {
    id: 'toko',
    name: 'Toko',
    priceIdr: 299_000,
    blurb: 'For growing teams that want to build on the API.',
    features: [
      '10 agents',
      'Unlimited tickets',
      'Everything in Warung',
      'WhatsApp channel (beta) — 1 number · 1.500 msgs/bln',
      'WA overage Rp 150/msg',
      'REST API + CLI',
      'Email support',
    ],
  },
  {
    id: 'bisnis',
    name: 'Bisnis',
    priceIdr: 599_000,
    blurb: 'For bigger teams and multi-number WhatsApp support.',
    features: [
      '25 agents',
      'Unlimited tickets',
      'Everything in Toko',
      'WhatsApp channel (beta) — 3 numbers · 4.000 msgs/bln',
      'WA overage Rp 150/msg — or BYO Twilio = unlimited',
      'REST API + CLI',
      'Priority WhatsApp support',
    ],
  },
];

export function isBillingTier(v: unknown): v is BillingTier {
  return typeof v === 'string' && (BILLING_TIERS as readonly string[]).includes(v);
}

export function tierDef(tier: BillingTier): TierDef {
  // BILLING_TIERS and TIER_DEFS are maintained together; the find is total.
  return TIER_DEFS.find((t) => t.id === tier)!;
}

export function isPaidTier(tier: BillingTier): boolean {
  return tierDef(tier).priceIdr > 0;
}

/** Parse + validate the metadata stamped onto a Suppuo checkout
 *  session. Returns null unless it names a workspace AND a paid tier
 *  (gratis is never purchased — absence of a row IS gratis). */
export function parseCheckoutMetadata(
  metadata: Record<string, unknown> | null | undefined,
): { accountId: string; tier: BillingTier } | null {
  const md = metadata ?? {};
  const accountId = typeof md.accountId === 'string' ? md.accountId.trim() : '';
  const tier = md.tier;
  if (!accountId || !isBillingTier(tier) || !isPaidTier(tier)) return null;
  return { accountId, tier };
}

/** How long a purchased period runs. v1 has no recurring charge wired
 *  yet — each completed checkout buys 30 days. */
export const PERIOD_DAYS = 30;

/** Minimal DB surface `applyCheckoutCompleted` needs — lets the unit
 *  tests exercise the idempotency guard with an in-memory fake instead
 *  of a live Postgres. */
export interface BillingDb {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

/** Webhook apply step for plugipay.checkout_session.completed.v1.
 *
 *  Idempotent: guarded on the checkout session id — Plugipay retries
 *  deliveries, and the same session must never grant two periods. The
 *  guard + upsert + outbox write share one transaction (ADR-0006).
 */
export async function applyCheckoutCompleted(
  db: BillingDb,
  input: { sessionId: string; accountId: string; tier: BillingTier },
): Promise<'applied' | 'duplicate'> {
  return db.$transaction(async (tx) => {
    const dup = await tx.billingSubscription.findFirst({
      where: { plugipayCheckoutSessionId: input.sessionId },
      select: { id: true },
    });
    if (dup) return 'duplicate' as const;

    const currentPeriodEnd = new Date(Date.now() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const sub = await tx.billingSubscription.upsert({
      where: { accountId: input.accountId },
      create: {
        id: newId('bsub'),
        accountId: input.accountId,
        tier: input.tier,
        status: 'active',
        plugipayCheckoutSessionId: input.sessionId,
        currentPeriodEnd,
      },
      update: {
        tier: input.tier,
        status: 'active',
        plugipayCheckoutSessionId: input.sessionId,
        currentPeriodEnd,
      },
    });
    await writeOutbox(tx, {
      type: 'suppuo.billing.subscribed.v1',
      accountId: input.accountId,
      aggregateId: sub.id,
      data: {
        subscriptionId: sub.id,
        tier: input.tier,
        plugipayCheckoutSessionId: input.sessionId,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
      },
    });
    return 'applied' as const;
  });
}

import { Router } from 'express';
import { sendOk, sendErr } from '../lib/http.js';
import { prisma } from '../lib/db.js';
import { tierDef, type BillingTier } from '../lib/billing.js';
import {
  collectBusinessMetrics,
  defaultWindow,
  type MetricsAdapter,
} from '../lib/business-metrics.js';

/*
 * GET /api/v1/admin/metrics?days=30 — suppuo's business metrics.
 *
 * Mounted behind `adminGuard`; powers `BusinessMetricsPanel` and the
 * headline tiles on `AdminOverviewPanel`. Mandatory admin-portal standard.
 *
 * REVENUE IS MRR, NOT A LEDGER. Suppuo bills flat per-workspace tiers and
 * keeps no per-payment table, so `transactions.count` is the number of
 * PAYING WORKSPACES and `grossMinor` is their combined monthly price —
 * not a count of money movements in the window. Reporting a zeroed slice
 * instead would say "this product earns nothing", which is worse than a
 * clearly-labelled recurring figure.
 *
 * Prices in `billing.ts` are whole RUPIAH; the contract carries MINOR
 * units, hence the x100.
 */

const RUPIAH_TO_MINOR = 100;

/** Only a live subscription counts. A cancelled or past-due row still
 *  carries its tier, and counting it would keep churned revenue on the
 *  board indefinitely. */
const LIVE_STATUS = 'active';

const adapter: MetricsAdapter = {
  workspaces: async ({ from }) => {
    const [total, active] = await Promise.all([
      prisma.rosterMembership
        .findMany({ distinct: ['accountId'], select: { accountId: true } })
        .then((r) => r.length),
      // "Active" for a helpdesk means someone actually worked a ticket in
      // the window — a seat that never opens the product is not active,
      // whatever its subscription says.
      prisma.ticket
        .findMany({
          where: { lastMessageAt: { gte: from } },
          distinct: ['accountId'],
          select: { accountId: true },
        })
        .then((r) => r.length),
    ]);
    return { total, active };
  },

  // Distinct identities, not membership rows — one agent in three
  // workspaces is one person.
  workspaceMembers: async () =>
    prisma.rosterMembership
      .findMany({ distinct: ['huudisSub'], select: { huudisSub: true } })
      .then((r) => r.length),

  transactions: async () => {
    const subs = await prisma.billingSubscription.findMany({
      where: { status: LIVE_STATUS },
      select: { accountId: true, tier: true },
    });
    const paying = subs.filter((s) => tierDef(s.tier as BillingTier).priceIdr > 0);
    const grossIdr = paying.reduce(
      (sum, s) => sum + tierDef(s.tier as BillingTier).priceIdr,
      0,
    );
    return {
      count: paying.length,
      grossMinor: grossIdr * RUPIAH_TO_MINOR,
      currency: 'IDR',
      payers: paying.length,
    };
  },

  series: async ({ from, to }) => {
    // Ticket volume is suppuo's real daily signal; there is no per-day
    // money movement to chart against flat monthly tiers, so the revenue
    // column stays 0 rather than smearing MRR across days it did not
    // arrive on.
    const rows = await prisma.$queryRaw<{ day: Date; tickets: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS tickets
      FROM tickets
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((r) => ({
      at: r.day.toISOString(),
      users: 0,
      transactions: Number(r.tickets),
      grossMinor: 0,
    }));
  },
};

const router = Router();

router.get('/', async (req, res) => {
  const raw = typeof req.query.days === 'string' ? Number(req.query.days) : 30;
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 365) : 30;
  try {
    return sendOk(res, req, await collectBusinessMetrics(adapter, defaultWindow(days)));
  } catch (e) {
    return sendErr(res, req, 500, 'METRICS_COLLECT_FAILED', (e as Error).message);
  }
});

export default router;

import { Router } from 'express';
import { sendOk, sendErr } from '../lib/http.js';
import { prisma } from '../lib/db.js';
import { tierDef, type BillingTier } from '../lib/billing.js';

/*
 * GET /api/v1/admin/transactions — the admin-portal standard's
 * Transactions contract (`AdminTransactionList` in @forjio/admin-ui).
 *
 * THIS PAGE IS THE ITEMISATION OF THE BUSINESS-METRICS TILE. Same rows,
 * same filter as the `transactions` slice of admin-metrics.ts. If the two
 * ever disagree an operator has no way to tell which one is lying.
 *
 * THESE ARE RECURRING CHARGES, NOT A PAYMENT LEDGER. Suppuo bills flat
 * monthly tiers through Plugipay and keeps no per-payment table of its
 * own, so there is nothing here that landed on a date. Each row is one
 * paying workspace at its monthly price, and `at` is when the current
 * period ENDS — the next time that money is due — rather than a payment
 * timestamp that does not exist. The `note` says so on screen, because a
 * ledger whose dates mean something unusual is worse than one that
 * explains itself.
 *
 * A canceled or past-due row still carries its tier. Only `active`
 * counts, or churned revenue stays on the board forever. Free-tier
 * workspaces are excluded rather than listed at Rp 0: a page of zero-
 * value rows buries the paying ones it exists to show.
 *
 * `days` is accepted and ignored: MRR is a standing figure, not a
 * windowed one, and silently returning fewer rows for a shorter window
 * would make the page disagree with the metrics tile.
 */

const router = Router();

/** A cancelled or past-due row still carries its tier. */
const LIVE_STATUS = 'active';

const RUPIAH_TO_MINOR = 100;

router.get('/', async (req, res) => {
  try {
    const subs = await prisma.billingSubscription.findMany({
      where: { status: LIVE_STATUS },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        accountId: true,
        tier: true,
        currentPeriodEnd: true,
        updatedAt: true,
      },
    });

    const paying = subs.filter((s) => tierDef(s.tier as BillingTier).priceIdr > 0);
    const grossIdr = paying.reduce(
      (sum, s) => sum + tierDef(s.tier as BillingTier).priceIdr,
      0,
    );

    const payload = {
      rows: paying.map((s) => ({
        id: s.id,
        at: (s.currentPeriodEnd ?? s.updatedAt).toISOString(),
        customer: s.accountId,
        kind: 'subscription',
        amountMinor: tierDef(s.tier as BillingTier).priceIdr * RUPIAH_TO_MINOR,
        currency: 'IDR',
        status: 'active',
        description: `${s.tier} plan · monthly`,
      })),
      summary: {
        // count === payers here, and that is correct rather than lazy:
        // one recurring charge per paying workspace.
        count: paying.length,
        grossMinor: grossIdr * RUPIAH_TO_MINOR,
        currency: 'IDR',
        payers: paying.length,
      },
      note: 'Recurring monthly charges, not a payment ledger — Suppuo bills flat tiers through Plugipay and keeps no per-payment table. Dates are when each period ends.',
    };
    return sendOk(res, req, payload);
  } catch (e) {
    return sendErr(res, req, 500, 'TRANSACTIONS_FAILED', (e as Error).message);
  }
});

export default router;

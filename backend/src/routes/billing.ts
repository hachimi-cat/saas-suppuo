import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { sendOk, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { getPlugipayClient, hostedCheckoutUrl, plugipayConfigured } from '../lib/plugipay.js';
import { TIER_DEFS, isPaidTier, tierDef, type BillingTier } from '../lib/billing.js';

/*
 * /api/v1/billing — workspace plan + Plugipay checkout (behind
 * requireAuth; accountId = the workspace from the BFF session /
 * Bearer claims).
 *
 * Early access: purchases are real and recorded truthfully, but no
 * limits are enforced anywhere — every workspace currently gets
 * Toko-level features free. v1 intentionally ships no enforcement.
 */

const router = Router();

const PUBLIC_URL = () => process.env.SUPPUO_PUBLIC_URL ?? 'https://suppuo.forjio.com';

/** GET / — current subscription (gratis default when no row) + the
 *  tier table the portal renders. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const sub = await prisma.billingSubscription.findUnique({ where: { accountId } });
    sendOk(res, req, {
      subscription: sub ?? {
        id: null,
        accountId,
        tier: 'gratis' as BillingTier,
        status: 'active',
        plugipayCheckoutSessionId: null,
        currentPeriodEnd: null,
      },
      earlyAccess: true,
      tiers: TIER_DEFS,
    });
  }),
);

const checkoutBody = z.object({
  tier: z.enum(['gratis', 'warung', 'toko', 'bisnis']),
});

/** POST /checkout {tier} — create a Plugipay hosted checkout session
 *  for a paid tier; the browser redirects to data.hostedUrl. The
 *  subscription itself is only written when the
 *  plugipay.checkout_session.completed.v1 webhook lands. */
router.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const { tier } = checkoutBody.parse(req.body);
    if (!isPaidTier(tier)) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'gratis needs no checkout', {
        param: 'tier',
      });
    }
    if (!plugipayConfigured()) {
      return sendErr(res, req, 503, 'NOT_CONFIGURED', 'Plugipay billing is not configured');
    }

    const accountId = req.auth!.accountId as string;
    const def = tierDef(tier);
    const client = getPlugipayClient();
    const session = await client.checkoutSessions.create({
      amount: def.priceIdr,
      currency: 'IDR',
      methods: ['qris', 'va', 'ewallet', 'card'],
      successUrl: `${PUBLIC_URL()}/dashboard/billing?status=success`,
      cancelUrl: `${PUBLIC_URL()}/dashboard/billing?status=canceled`,
      lineItems: [
        {
          name: `Suppuo ${def.name} — Rp ${def.priceIdr.toLocaleString('id-ID')}/bln`,
          quantity: 1,
          unitAmount: def.priceIdr,
        },
      ],
      metadata: { accountId, tier },
    });

    sendOk(res, req, {
      checkoutSessionId: session.id,
      hostedUrl: hostedCheckoutUrl(session),
    });
  }),
);

export default router;

import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';

/*
 * /api/v1/csat — agent-side CSAT aggregates (behind requireAuth).
 * Feature wave: CSAT + automation. Powers the dashboard's
 * satisfaction card: average score (1..3) + response count.
 */

const router = Router();

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const agg = await prisma.csatResponse.aggregate({
      where: { accountId },
      _avg: { score: true },
      _count: { _all: true },
    });
    sendOk(res, req, {
      average: agg._avg.score !== null ? Math.round(agg._avg.score * 100) / 100 : null,
      count: agg._count._all,
    });
  }),
);

export default router;

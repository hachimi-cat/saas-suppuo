import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import {
  fillDailySeries,
  median,
  percentile,
  parseDaysParam,
  type DailyCount,
} from '../lib/reports.js';

/*
 * /api/v1/reports — on-the-fly support analytics (behind requireAuth).
 * Read-only aggregates over this workspace's own rows; no new tables,
 * no migration. Resolution time leans on the outbox history
 * (`suppuo.ticket.status_changed.v1` rows carry `data.to`), which is
 * the closest thing we have to an event log — see ADR-0006.
 */

const router = Router();

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const days = parseDaysParam(req.query.days);
    const since = new Date(Date.now() - days * 86_400_000);

    const [
      rawDaily,
      byChannelRows,
      byStatusRows,
      resolvedRows,
      firstResponseRows,
      resolutionRows,
      csatAgg,
      csatDistRows,
    ] = await Promise.all([
      // Tickets created per UTC day (sparse — gap-filled below).
      prisma.$queryRaw<DailyCount[]>`
        SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
               count(*)::int AS count
        FROM tickets
        WHERE "accountId" = ${accountId} AND "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1`,
      prisma.ticket.groupBy({
        by: ['channel'],
        where: { accountId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      // Status distribution is a CURRENT snapshot (all tickets), not
      // period-scoped — "open now" must mean now.
      prisma.ticket.groupBy({
        by: ['status'],
        where: { accountId },
        _count: { _all: true },
      }),
      // Distinct tickets that transitioned to resolved inside the window.
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(DISTINCT "aggregateId")::int AS count
        FROM outbox_events
        WHERE "accountId" = ${accountId}
          AND type = 'suppuo.ticket.status_changed.v1'
          AND data->>'to' = 'resolved'
          AND "occurredAt" >= ${since}`,
      // First response: per ticket created in the window, seconds from
      // creation to the FIRST agent non-internal message.
      prisma.$queryRaw<Array<{ seconds: number }>>`
        SELECT EXTRACT(EPOCH FROM (min(tm."createdAt") - t."createdAt"))::float8 AS seconds
        FROM tickets t
        JOIN ticket_messages tm
          ON tm."ticketId" = t.id
         AND tm."authorType" = 'agent'
         AND tm."isInternal" = false
        WHERE t."accountId" = ${accountId} AND t."createdAt" >= ${since}
        GROUP BY t.id, t."createdAt"`,
      // Resolution: per ticket created in the window, seconds from
      // creation to its first status_changed→resolved outbox event.
      prisma.$queryRaw<Array<{ seconds: number }>>`
        SELECT EXTRACT(EPOCH FROM (min(e."occurredAt") - t."createdAt"))::float8 AS seconds
        FROM tickets t
        JOIN outbox_events e
          ON e."aggregateId" = t.id
         AND e."accountId" = ${accountId}
         AND e.type = 'suppuo.ticket.status_changed.v1'
         AND e.data->>'to' = 'resolved'
        WHERE t."accountId" = ${accountId} AND t."createdAt" >= ${since}
        GROUP BY t.id, t."createdAt"`,
      prisma.csatResponse.aggregate({
        where: { accountId, createdAt: { gte: since } },
        _avg: { score: true },
        _count: { _all: true },
      }),
      prisma.csatResponse.groupBy({
        by: ['score'],
        where: { accountId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    const createdPerDay = fillDailySeries(rawDaily, days);
    const createdTotal = createdPerDay.reduce((sum, r) => sum + r.count, 0);

    const byStatus = byStatusRows
      .map((r) => ({ status: r.status, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
    const byChannel = byChannelRows
      .map((r) => ({ channel: r.channel, count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    const frt = firstResponseRows.map((r) => r.seconds);
    const rt = resolutionRows.map((r) => r.seconds);

    // score is validated 1..3 at the API edge — keys are stable.
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
    for (const row of csatDistRows) distribution[String(row.score)] = row._count._all;

    sendOk(res, req, {
      periodDays: days,
      createdPerDay,
      createdTotal,
      byChannel,
      byStatus,
      openNow: byStatus.find((s) => s.status === 'open')?.count ?? 0,
      resolvedInPeriod: resolvedRows[0]?.count ?? 0,
      firstResponse: {
        medianSeconds: median(frt),
        p90Seconds: percentile(frt, 0.9),
        count: frt.length,
      },
      resolution: {
        medianSeconds: median(rt),
        p90Seconds: percentile(rt, 0.9),
        count: rt.length,
      },
      csat: {
        average:
          csatAgg._avg.score !== null ? Math.round(csatAgg._avg.score * 100) / 100 : null,
        count: csatAgg._count._all,
        distribution,
      },
    });
  }),
);

export default router;

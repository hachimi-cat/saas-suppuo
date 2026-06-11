import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';

/*
 * /api/v1/admin/crm — the standardized Forjio CRM contract (stats /
 * customers / transactions), served s2s to the central admin portal
 * behind adminGuard's X-Forjio-Admin-Secret path.
 */

const router = Router();

const fmtCount = (n: number) => n.toLocaleString('en-US');

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [workspaces, tickets, tickets30d, open, resolved] = await Promise.all([
      prisma.ticket.groupBy({ by: ['accountId'] }).then((r) => r.length),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { createdAt: { gte: since30d } } }),
      prisma.ticket.count({ where: { status: { in: ['open', 'pending'] } } }),
      prisma.ticket.count({ where: { status: { in: ['resolved', 'closed'] } } }),
    ]);
    sendOk(res, req, {
      stats: [
        { key: 'workspaces', label: 'Workspaces with tickets', value: fmtCount(workspaces) },
        { key: 'tickets', label: 'Tickets (lifetime)', value: fmtCount(tickets), accent: true },
        { key: 'tickets30d', label: 'Tickets (30d)', value: fmtCount(tickets30d), accent: tickets30d > 0 },
        { key: 'open', label: 'Open + pending', value: fmtCount(open) },
        { key: 'resolved', label: 'Resolved + closed', value: fmtCount(resolved) },
      ],
    });
  }),
);

router.get(
  '/customers',
  asyncHandler(async (req, res) => {
    // Suppuo's "customers" at the CRM level are the WORKSPACES running
    // a support inbox (agent identity lives in Huudis; requesters are
    // per-ticket contacts, surfaced in /transactions).
    const grouped = await prisma.ticket.groupBy({
      by: ['accountId'],
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { lastMessageAt: true },
    });
    const customers = await Promise.all(
      grouped.map(async (g) => {
        const [openCount, resolvedCount] = await Promise.all([
          prisma.ticket.count({
            where: { accountId: g.accountId, status: { in: ['open', 'pending'] } },
          }),
          prisma.ticket.count({
            where: { accountId: g.accountId, status: { in: ['resolved', 'closed'] } },
          }),
        ]);
        return {
          id: g.accountId,
          email: null,
          name: g.accountId,
          signupAt: g._min.createdAt,
          lastActiveAt: g._max.lastMessageAt,
          status: openCount > 0 ? 'active' : 'quiet',
          metrics: [
            { label: 'Tickets', value: fmtCount(g._count._all) },
            { label: 'Open', value: fmtCount(openCount) },
            { label: 'Resolved', value: fmtCount(resolvedCount) },
          ],
          // Raw numbers for the in-product admin portal (the central
          // portal reads the formatted `metrics` above).
          ticketCount: g._count._all,
          openCount,
          resolvedCount,
        };
      }),
    );
    sendOk(res, req, { customers });
  }),
);

router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const [tickets, total, resolved] = await Promise.all([
      prisma.ticket.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: { in: ['resolved', 'closed'] } } }),
    ]);
    sendOk(res, req, {
      summary: [
        { label: 'Tickets (lifetime)', value: fmtCount(total) },
        { label: 'Resolved', value: fmtCount(resolved) },
        {
          label: 'Resolution rate',
          value: total > 0 ? `${Math.round((resolved / total) * 100)}%` : '—',
        },
      ],
      rows: tickets.map((t) => ({
        id: t.id,
        at: t.createdAt,
        customer: t.requesterEmail,
        kind: 'ticket',
        amount: null,
        status: t.status,
        description: `#${t.number} ${t.subject}`,
        // Ticket detail for the in-product admin portal (additive — the
        // central portal reads only the standardized fields above).
        number: t.number,
        subject: t.subject,
        accountId: t.accountId,
        channel: t.channel,
        priority: t.priority,
        lastMessageAt: t.lastMessageAt,
      })),
    });
  }),
);

export default router;

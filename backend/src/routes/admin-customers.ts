import { Router } from 'express';
import { sendOk, sendErr } from '../lib/http.js';
import { prisma } from '../lib/db.js';
import {
  fetchAppUsers,
  fetchAppStats,
  huudisAppConfigured,
} from '../lib/huudis-app.js';

/*
 * GET /api/v1/admin/customers — the admin-portal standard's Customers
 * contract (`AdminCustomer` in @forjio/admin-ui).
 *
 * This REPLACES the old passthrough, which returned the raw Huudis
 * `/app/users` roster and nothing else. A list of email addresses answers
 * "who signed in" and none of "is this helpdesk actually being used",
 * which is what an operator opens the page for. bang's instruction was to
 * enrich rather than level down, so every row is joined against suppuo's
 * own ticket data first.
 *
 * The join is in process rather than in SQL: Huudis owns the roster and
 * lives in another service, so there is no join to write. Each fact is
 * ONE grouped query regardless of page size — the n+1 this avoids.
 */

const router = Router();

/** Tickets still needing somebody. 'resolved' and 'closed' do not. */
const OPEN_STATES = ['open', 'pending'];

const NEW_WINDOW_MS = 30 * 86_400_000;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

router.get('/', async (req, res) => {
  if (!huudisAppConfigured()) {
    return sendErr(
      res,
      req,
      503,
      'HUUDIS_NOT_CONFIGURED',
      'HUUDIS_CLIENT_ID / HUUDIS_CLIENT_SECRET must be set to list customers.',
    );
  }
  try {
    const limitRaw = str(req.query.limit);
    const [page, stats] = await Promise.all([
      fetchAppUsers({
        q: str(req.query.q),
        status: str(req.query.status) as 'all' | 'active' | 'disabled' | undefined,
        limit: limitRaw ? Number(limitRaw) : 200,
        cursor: str(req.query.cursor),
      }),
      fetchAppStats().catch(() => null),
    ]);

    const subs = page.users.map((u) => u.id);
    const memberships = subs.length
      ? await prisma.rosterMembership.findMany({
          where: { huudisSub: { in: subs } },
          select: { huudisSub: true, accountId: true, lastSeenAt: true },
        })
      : [];

    const accountsBySub = new Map<string, string[]>();
    const lastSeenBySub = new Map<string, Date>();
    for (const m of memberships) {
      (accountsBySub.get(m.huudisSub) ?? accountsBySub.set(m.huudisSub, []).get(m.huudisSub)!).push(
        m.accountId,
      );
      const prev = lastSeenBySub.get(m.huudisSub);
      if (!prev || m.lastSeenAt > prev) lastSeenBySub.set(m.huudisSub, m.lastSeenAt);
    }
    const accountIds = [...new Set(memberships.map((m) => m.accountId))];

    const [tickets, open, csat] = await Promise.all([
      accountIds.length
        ? prisma.ticket.groupBy({
            by: ['accountId'],
            where: { accountId: { in: accountIds } },
            _count: { _all: true },
            _max: { createdAt: true },
          })
        : [],
      accountIds.length
        ? prisma.ticket.groupBy({
            by: ['accountId'],
            where: { accountId: { in: accountIds }, status: { in: OPEN_STATES } },
            _count: { _all: true },
          })
        : [],
      accountIds.length
        ? prisma.csatResponse.groupBy({
            by: ['accountId'],
            where: { accountId: { in: accountIds } },
            _avg: { score: true },
            _count: { _all: true },
          })
        : [],
    ]);

    const ticketsBy = new Map(tickets.map((r) => [r.accountId, r]));
    const openBy = new Map(open.map((r) => [r.accountId, r._count._all]));
    const csatBy = new Map(csat.map((r) => [r.accountId, r]));

    const now = Date.now();
    const customers = page.users.map((u) => {
      const accts = accountsBySub.get(u.id) ?? [];
      const total = accts.reduce((n, a) => n + (ticketsBy.get(a)?._count._all ?? 0), 0);
      const openCount = accts.reduce((n, a) => n + (openBy.get(a) ?? 0), 0);
      const lastTicketAt = accts
        .map((a) => ticketsBy.get(a)?._max.createdAt)
        .filter((d): d is Date => !!d)
        .sort((x, y) => y.getTime() - x.getTime())[0];

      // CSAT across several workspaces is a WEIGHTED mean. Averaging the
      // per-workspace averages unweighted would let a desk with one
      // response outvote one with two hundred.
      const csatRows = accts
        .map((a) => csatBy.get(a))
        .filter((r): r is NonNullable<typeof r> => !!r);
      const csatN = csatRows.reduce((n, r) => n + r._count._all, 0);
      const csatSum = csatRows.reduce((n, r) => n + (r._avg.score ?? 0) * r._count._all, 0);

      const tags: string[] = [];
      if (u.disabled) tags.push('disabled');
      if (!u.emailVerified) tags.push('unverified');
      if (accts.length === 0) tags.push('no-workspace');
      if (openCount > 0) tags.push('has-open');
      if (total > 0) tags.push('active-desk');
      if (now - new Date(u.firstSignInAt).getTime() < NEW_WINDOW_MS) tags.push('new');

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.disabled ? 'disabled' : 'active',
        signedUpAt: u.firstSignInAt,
        // The roster's lastSeenAt beats the SSO one: it records acting in
        // THIS product, where the Huudis figure only records signing in
        // somewhere in the family.
        lastSeenAt: (lastSeenBySub.get(u.id) ?? new Date(u.lastSignInAt)).toISOString(),
        workspaceId: accts[0] ?? null,
        tags,
        metrics: [
          { label: 'Tickets', value: total.toLocaleString('en-GB') },
          { label: 'Open', value: openCount.toLocaleString('en-GB') },
          {
            label: 'CSAT',
            // An em dash, never a confident "0.0" — nobody has rated them.
            value: csatN ? `${(csatSum / csatN).toFixed(1)}/3 (${csatN})` : '—',
          },
          {
            label: 'Last ticket',
            value: lastTicketAt ? lastTicketAt.toISOString().slice(0, 10) : '—',
          },
        ],
      };
    });

    return sendOk(res, req, {
      customers,
      total: stats?.users.total ?? customers.length,
    });
  } catch (e) {
    return sendErr(res, req, 502, 'CUSTOMERS_ERROR', (e as Error).message);
  }
});

export default router;

'use client';

/*
 * Admin overview — cross-workspace ticket stats via the CRM endpoints
 * (proxied at /api/v1/console/crm/*, adminGuard resolves the admin
 * session from the role header the console proxy stamps). Stat cards +
 * the 10 most recent tickets + quick links into the CRM views.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { AdminOverviewPanel } from '@forjio/admin-ui';
import { SUPPUO_ADMIN_ENDPOINTS } from '@/lib/admin-endpoints';
import {
  adminFetch,
  Badge,
  ErrorBanner,
  fmtRelative,
  LoadingHint,
  shortId,
  StatCard,
  TD,
  TH,
  TH_ROW,
} from '@/components/admin/ui';

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Suppuo';

interface Stat {
  key: string;
  label: string;
  value: string;
  accent?: boolean;
}

interface TicketRow {
  id: string;
  at: string;
  status: string;
  number: number;
  subject: string;
  accountId: string;
  channel: string;
}

const QUICK_LINKS = [
  {
    href: '/admin/customers',
    label: 'Customers',
    description: 'Everyone signed into this product via Huudis SSO.',
  },
  {
    href: '/admin/workspaces',
    label: 'Workspaces',
    description: 'Per-workspace ticket rollups and activity.',
  },
  {
    href: '/admin/tickets',
    label: 'Tickets',
    description: 'The cross-workspace ticket stream.',
  },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [rows, setRows] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, txRes] = await Promise.all([
        adminFetch<{ stats: Stat[] }>('/api/v1/console/crm/stats'),
        adminFetch<{ rows: TicketRow[] }>('/api/v1/console/crm/transactions?limit=10'),
      ]);
      setStats(statsRes.stats ?? []);
      setRows(txRes.rows ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {/* The MANDATORY standard first — business metrics, system health and
          feature flags from the three shared contracts. Suppuo's own ticket
          activity follows BELOW: on top of the standard, never instead. */}
      <AdminOverviewPanel brand={brand} quickLinks={QUICK_LINKS} endpoints={SUPPUO_ADMIN_ENDPOINTS} />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Ticket activity
          </h2>
          <p className="text-xs text-muted-foreground">
            Platform-wide ticket activity across every workspace.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && !stats && !error && <LoadingHint label="Loading overview…" />}

      {stats && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {stats.map((s) => (
            <StatCard key={s.key} label={s.label} value={s.value} accent={s.accent} />
          ))}
        </div>
      )}

      {rows && (
        <section className="mt-7">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent tickets
            </h2>
            <Link
              href="/admin/tickets"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className={TH_ROW}>
                  <th className={TH}>#</th>
                  <th className={TH}>Subject</th>
                  <th className={TH}>Workspace</th>
                  <th className={TH}>Channel</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No tickets yet.
                    </td>
                  </tr>
                )}
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/30">
                    <td className={`${TD} whitespace-nowrap font-mono text-muted-foreground`}>
                      #{t.number}
                    </td>
                    <td className={`${TD} max-w-[320px] truncate font-medium`}>{t.subject}</td>
                    <td className={`${TD} whitespace-nowrap font-mono text-xs text-muted-foreground`}>
                      {shortId(t.accountId)}
                    </td>
                    <td className={`${TD} capitalize text-muted-foreground`}>{t.channel}</td>
                    <td className={TD}>
                      <Badge tone={t.status}>{t.status}</Badge>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                      {fmtRelative(t.at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}

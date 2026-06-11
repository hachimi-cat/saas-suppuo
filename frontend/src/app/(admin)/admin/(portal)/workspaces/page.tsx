'use client';

/*
 * Admin "Workspaces" — the CRM workspace rollups (/api/v1/console/crm/
 * customers): every workspace running a support inbox, with its ticket
 * counts (total / open / resolved) and last activity. A workspace is
 * "active" while it has open or pending tickets, "quiet" otherwise.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import {
  adminFetch,
  Badge,
  ErrorBanner,
  fmtDate,
  fmtRelative,
  LoadingHint,
  StatCard,
  TD,
  TH,
  TH_ROW,
} from '@/components/admin/ui';

interface WorkspaceRow {
  id: string; // accountId
  signupAt: string | null; // first ticket
  lastActiveAt: string | null; // last message
  status: string; // active | quiet
  ticketCount: number;
  openCount: number;
  resolvedCount: number;
}

export default function AdminWorkspacesPage() {
  const [rows, setRows] = useState<WorkspaceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetch<{ customers: WorkspaceRow[] }>(
        '/api/v1/console/crm/customers',
      );
      const sorted = [...(body.customers ?? [])].sort(
        (a, b) =>
          new Date(b.lastActiveAt ?? 0).getTime() - new Date(a.lastActiveAt ?? 0).getTime(),
      );
      setRows(sorted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.id.toLowerCase().includes(q));
  }, [rows, query]);

  const stats = useMemo(() => {
    if (!rows) return null;
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      tickets: rows.reduce((s, r) => s + r.ticketCount, 0),
      open: rows.reduce((s, r) => s + r.openCount, 0),
    };
  }, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every workspace running a support inbox, with its ticket volume and activity.
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

      {stats && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Workspaces" value={stats.total} />
          <StatCard label="With open tickets" value={stats.active} accent={stats.active > 0} />
          <StatCard label="Tickets (lifetime)" value={stats.tickets.toLocaleString('en-US')} />
          <StatCard label="Open + pending" value={stats.open.toLocaleString('en-US')} />
        </div>
      )}

      <div className="relative mt-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workspace id…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && !rows && !error && <LoadingHint label="Loading workspaces…" />}

      {filtered && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className={TH_ROW}>
                <th className={TH}>Workspace</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Tickets</th>
                <th className={`${TH} text-right`}>Open</th>
                <th className={`${TH} text-right`}>Resolved</th>
                <th className={TH}>First ticket</th>
                <th className={TH}>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    {query ? 'No workspaces match.' : 'No workspaces with tickets yet.'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/30">
                  <td className={`${TD} font-mono text-xs`}>{r.id}</td>
                  <td className={TD}>
                    <Badge tone={r.status}>{r.status}</Badge>
                  </td>
                  <td className={`${TD} text-right font-medium tabular-nums`}>
                    {r.ticketCount.toLocaleString('en-US')}
                  </td>
                  <td className={`${TD} text-right tabular-nums ${r.openCount > 0 ? 'font-medium text-rose-500' : 'text-muted-foreground'}`}>
                    {r.openCount.toLocaleString('en-US')}
                  </td>
                  <td className={`${TD} text-right tabular-nums text-muted-foreground`}>
                    {r.resolvedCount.toLocaleString('en-US')}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                    {fmtDate(r.signupAt)}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                    {fmtRelative(r.lastActiveAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

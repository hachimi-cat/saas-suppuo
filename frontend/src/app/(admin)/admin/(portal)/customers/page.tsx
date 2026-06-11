'use client';

/*
 * Admin "Customers" — every user who has signed into THIS product via
 * Huudis SSO. Data comes from the backend admin route
 * (/api/v1/admin/customers → Huudis /app/users) through the admin BFF
 * proxy at /api/v1/console/*; no secret in the browser.
 *
 * Built to the family admin standard (pawpado's users page): header
 * stat chips, search box, tone badges, relative times, em-dash empties,
 * defensive JSON fetch.
 *
 * rename.sh rewrites the "Suppuo" display name.
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

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Suppuo';

interface Customer {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  firstSignInAt: string;
  lastSignInAt: string;
}

interface Payload {
  client: { clientId: string; name: string };
  users: Customer[];
  nextCursor: string | null;
  stats: { users: { total: number; signupsLast30d: number } } | null;
}

export default function AdminCustomersPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<Payload>('/api/v1/console/customers?limit=200'));
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
    if (!data) return null;
    const q = query.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who has signed into {brand} via Huudis SSO.
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

      {data?.stats && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
          <StatCard label="Total customers" value={data.stats.users.total} />
          <StatCard
            label="New (last 30d)"
            value={data.stats.users.signupsLast30d}
            accent={data.stats.users.signupsLast30d > 0}
          />
        </div>
      )}

      <div className="relative mt-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email or name…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && !data && !error && <LoadingHint label="Loading customers…" />}

      {filtered && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className={TH_ROW}>
                <th className={TH}>Customer</th>
                <th className={TH}>Status</th>
                <th className={TH}>First sign-in</th>
                <th className={TH}>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {query ? 'No customers match.' : 'No customers yet.'}
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/30">
                  <td className={TD}>
                    <p className="truncate font-medium">{u.email}</p>
                    {u.name ? (
                      <p className="truncate text-xs text-muted-foreground">{u.name}</p>
                    ) : null}
                  </td>
                  <td className={TD}>
                    <span className="inline-flex gap-1.5">
                      {u.disabled ? (
                        <Badge tone="disabled">disabled</Badge>
                      ) : (
                        <Badge tone="active">active</Badge>
                      )}
                      {!u.emailVerified && <Badge tone="unverified">unverified</Badge>}
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {fmtDate(u.firstSignInAt)}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({fmtRelative(u.firstSignInAt)})
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                    {fmtRelative(u.lastSignInAt ?? u.lastLoginAt)}
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

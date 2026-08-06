'use client';

/*
 * Admin "Tickets" — the cross-workspace ticket stream from the CRM
 * transactions endpoint (/api/v1/console/crm/transactions). Summary
 * chips (lifetime / resolved / resolution rate) + the latest tickets
 * with status, priority, channel and activity times.
 */

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  adminFetch,
  Badge,
  ErrorBanner,
  fmtRelative,
  LoadingHint,
  PRIORITY_TONES,
  shortId,
  StatCard,
  TD,
  TH,
  TH_ROW,
} from '@/components/admin/ui';

interface TicketRow {
  id: string;
  at: string;
  customer: string | null;
  status: string;
  number: number;
  subject: string;
  accountId: string;
  channel: string;
  priority: string;
  lastMessageAt: string | null;
}

interface Payload {
  summary: Array<{ label: string; value: string }>;
  rows: TicketRow[];
}

const LIMITS = [50, 100, 200] as const;

export default function AdminTicketsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(100);

  const load = useCallback(async (n: number) => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<Payload>(`/api/v1/console/crm/transactions?limit=${n}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(limit);
  }, [load, limit]);

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="The latest tickets across every workspace, newest first."
        action={
          <>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {LIMITS.map((n) => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    limit === n
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => load(limit)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      {data && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.summary.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      {loading && !data && !error && <LoadingHint label="Loading tickets…" />}

      {data && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className={TH_ROW}>
                <th className={TH}>#</th>
                <th className={TH}>Subject</th>
                <th className={TH}>Workspace</th>
                <th className={TH}>Channel</th>
                <th className={TH}>Status</th>
                <th className={TH}>Priority</th>
                <th className={TH}>Created</th>
                <th className={TH}>Last message</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No tickets yet.
                  </td>
                </tr>
              )}
              {data.rows.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/30">
                  <td className={`${TD} whitespace-nowrap font-mono text-muted-foreground`}>
                    #{t.number}
                  </td>
                  <td className={`${TD} max-w-[280px]`}>
                    <p className="truncate font-medium">{t.subject}</p>
                    {t.customer ? (
                      <p className="truncate text-xs text-muted-foreground">{t.customer}</p>
                    ) : null}
                  </td>
                  <td className={`${TD} whitespace-nowrap font-mono text-xs text-muted-foreground`}>
                    {shortId(t.accountId)}
                  </td>
                  <td className={`${TD} capitalize text-muted-foreground`}>{t.channel}</td>
                  <td className={TD}>
                    <Badge tone={t.status}>{t.status}</Badge>
                  </td>
                  <td
                    className={`${TD} text-xs font-medium capitalize ${PRIORITY_TONES[t.priority] ?? 'text-muted-foreground'}`}
                  >
                    {t.priority}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                    {fmtRelative(t.at)}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                    {fmtRelative(t.lastMessageAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.rows.length >= limit && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing the latest {limit}. Summary totals cover all tickets.
        </p>
      )}
    </div>
  );
}

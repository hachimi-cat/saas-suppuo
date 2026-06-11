'use client';

/*
 * Reports — on-the-fly support analytics from /api/v1/reports/summary.
 * Stat cards + a lean CSS bar chart (no chart library — the template
 * stays dependency-free). Period switcher: 7 / 30 / 90 days.
 */

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface ReportSummary {
  periodDays: number;
  createdPerDay: Array<{ day: string; count: number }>;
  createdTotal: number;
  byChannel: Array<{ channel: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  openNow: number;
  resolvedInPeriod: number;
  firstResponse: { medianSeconds: number | null; p90Seconds: number | null; count: number };
  resolution: { medianSeconds: number | null; p90Seconds: number | null; count: number };
  csat: { average: number | null; count: number; distribution: Record<string, number> };
}

const PERIODS = [7, 30, 90] as const;

// DigitalOcean blue — the reports accent (charts only; chrome stays brand).
const DO_BLUE = '#0080FF';

const STATUS_TONES: Record<string, string> = {
  open: 'bg-rose-500',
  pending: 'bg-amber-500',
  resolved: 'bg-emerald-600',
  closed: 'bg-muted-foreground',
};

const CSAT_FACES: Record<string, string> = { '1': '😞', '2': '😐', '3': '😊' };

function fmtDuration(s: number | null | undefined): string {
  if (s == null) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3_600) return `${Math.round(s / 60)}m`;
  if (s < 86_400) return `${(s / 3_600).toFixed(1)}h`;
  return `${(s / 86_400).toFixed(1)}d`;
}

export default function ReportsPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<ReportSummary>(`/reports/summary?days=${days}`)
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [days]);

  const maxDay = Math.max(1, ...(summary?.createdPerDay.map((d) => d.count) ?? [0]));
  const maxChannel = Math.max(1, ...(summary?.byChannel.map((c) => c.count) ?? [0]));
  const statusTotal = summary?.byStatus.reduce((a, s) => a + s.count, 0) ?? 0;
  const csatMax = Math.max(1, ...Object.values(summary?.csat.distribution ?? {}));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How your support is doing — volume, response times, and satisfaction.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                days === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open now" value={summary ? String(summary.openNow) : '—'} />
        <StatCard label={`Created (${days}d)`} value={summary ? String(summary.createdTotal) : '—'} />
        <StatCard
          label="Median first response"
          value={fmtDuration(summary?.firstResponse.medianSeconds)}
          hint={summary ? `p90 ${fmtDuration(summary.firstResponse.p90Seconds)} · ${summary.firstResponse.count} answered` : undefined}
        />
        <StatCard
          label="CSAT avg"
          value={summary?.csat.average != null ? `${summary.csat.average.toFixed(1)} / 3` : '—'}
          hint={summary ? `${summary.csat.count} rating${summary.csat.count === 1 ? '' : 's'}` : undefined}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={`Resolved (${days}d)`} value={summary ? String(summary.resolvedInPeriod) : '—'} />
        <StatCard
          label="Median resolution"
          value={fmtDuration(summary?.resolution.medianSeconds)}
          hint={summary ? `p90 ${fmtDuration(summary.resolution.p90Seconds)} · ${summary.resolution.count} resolved` : undefined}
        />
        <div className="col-span-2 rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">CSAT distribution</p>
          <div className="mt-2 flex items-end gap-4">
            {(['1', '2', '3'] as const).map((score) => {
              const n = summary?.csat.distribution[score] ?? 0;
              return (
                <div key={score} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium">{n}</span>
                  <div className="flex h-10 w-full items-end rounded bg-muted/40">
                    <div
                      className="w-full rounded"
                      style={{ height: `${(n / csatMax) * 100}%`, backgroundColor: DO_BLUE }}
                    />
                  </div>
                  <span className="text-sm">{CSAT_FACES[score]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-day volume — lean CSS bars */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tickets created per day
        </h2>
        {loading && !summary ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : summary && summary.createdTotal > 0 ? (
          <>
            <div className="mt-4 flex h-36 items-end gap-px">
              {summary.createdPerDay.map((d) => (
                <div
                  key={d.day}
                  className="group relative flex h-full flex-1 items-end"
                  title={`${d.day}: ${d.count} ticket${d.count === 1 ? '' : 's'}`}
                >
                  <div
                    className="w-full rounded-t-sm transition-opacity group-hover:opacity-80"
                    style={{
                      height: d.count > 0 ? `${Math.max((d.count / maxDay) * 100, 3)}%` : '2px',
                      backgroundColor: d.count > 0 ? DO_BLUE : 'hsl(var(--muted))',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{summary.createdPerDay[0]?.day}</span>
              <span>{summary.createdPerDay[summary.createdPerDay.length - 1]?.day}</span>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No tickets in this period yet — share your support form to get started.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Per-channel breakdown */}
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            By channel ({days}d)
          </h2>
          <div className="mt-4 space-y-3">
            {(summary?.byChannel ?? []).map((c) => (
              <div key={c.channel} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="capitalize">{c.channel.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground">{c.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted/40">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${(c.count / maxChannel) * 100}%`, backgroundColor: DO_BLUE }}
                  />
                </div>
              </div>
            ))}
            {summary && summary.byChannel.length === 0 && (
              <p className="text-sm text-muted-foreground">No tickets in this period.</p>
            )}
          </div>
        </section>

        {/* Status distribution — current snapshot */}
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            By status (now)
          </h2>
          <div className="mt-4 space-y-3">
            {(summary?.byStatus ?? []).map((s) => (
              <div key={s.status} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="capitalize">{s.status}</span>
                  <span className="text-xs text-muted-foreground">{s.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted/40">
                  <div
                    className={`h-2 rounded-full ${STATUS_TONES[s.status] ?? ''}`}
                    style={{
                      width: `${statusTotal > 0 ? (s.count / statusTotal) * 100 : 0}%`,
                      ...(STATUS_TONES[s.status] ? {} : { backgroundColor: DO_BLUE }),
                    }}
                  />
                </div>
              </div>
            ))}
            {summary && summary.byStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

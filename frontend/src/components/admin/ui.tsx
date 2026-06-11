'use client';

/*
 * Shared primitives for the in-product admin portal pages — the same
 * conventions as the merchant dashboard (Tailwind, light theme,
 * DO-blue `--primary` accent), aligned with the family standard set by
 * pawpado's admin console: stat header cards, single-line tone badges,
 * relative times, em-dash empties, and a DEFENSIVE fetch that never
 * surfaces a raw JSON.parse error (check content-type before parsing).
 */

import { Loader2 } from 'lucide-react';

// ─── Data access ────────────────────────────────────────────────────

/**
 * Fetch an admin BFF endpoint (same-origin `/api/v1/console/*` proxy,
 * cookies included) and unwrap the `{ data }` envelope.
 *
 * Defensive: if the response is not JSON (an HTML error page, an nginx
 * gateway error, a redirect to login…) we throw a clean message instead
 * of letting `res.json()` surface the browser's raw parse error.
 */
export async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    throw new Error(
      res.ok
        ? 'The admin API returned an unexpected non-JSON response.'
        : `The admin API returned an unexpected response (HTTP ${res.status}). Try signing in again.`,
    );
  }
  const body = (await res.json()) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    throw new Error(
      body?.error?.message ?? body?.error?.code ?? `Request failed (HTTP ${res.status})`,
    );
  }
  return (body?.data ?? (body as unknown)) as T;
}

// ─── Formatters ─────────────────────────────────────────────────────

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d ago`;
  return `${Math.round(d / 30)}mo ago`;
}

export function shortId(id: string | null | undefined, head = 10): string {
  if (!id) return '—';
  return id.length > head + 4 ? `${id.slice(0, head)}…${id.slice(-4)}` : id;
}

// ─── Badges (light-theme tones, matching the merchant inbox) ────────

export const STATUS_TONES: Record<string, string> = {
  open: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  resolved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  quiet: 'bg-muted text-muted-foreground border-border',
  disabled: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  unverified: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

export const PRIORITY_TONES: Record<string, string> = {
  urgent: 'text-rose-500',
  high: 'text-amber-600',
  normal: 'text-muted-foreground',
  low: 'text-muted-foreground/60',
};

export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const style =
    (tone && STATUS_TONES[tone]) || 'bg-primary/10 text-primary border-primary/20';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${style}`}
    >
      {children}
    </span>
  );
}

// ─── Layout primitives ──────────────────────────────────────────────

export function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${accent ? 'text-primary' : ''}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-600">
      {message}
    </div>
  );
}

export function LoadingHint({ label }: { label: string }) {
  return (
    <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export const TH_ROW =
  'border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground';
export const TH = 'px-3 py-2 font-medium';
export const TD = 'px-3 py-2.5';

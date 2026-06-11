/*
 * Pure helpers for /api/v1/reports — dependency-free so they can be
 * unit-tested without a DB. The route (routes/reports.ts) runs the
 * account-scoped SQL and pipes the raw rows through these.
 */

export interface DailyCount {
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: string;
  count: number;
}

/** Format a Date as its UTC calendar day, `YYYY-MM-DD`. */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Expand a sparse `{day, count}` aggregate into a dense series covering
 * the last `days` UTC days (oldest first, ending today). Days with no
 * rows become `count: 0` so the chart renders gaps honestly.
 */
export function fillDailySeries(
  rows: DailyCount[],
  days: number,
  now: Date = new Date(),
): DailyCount[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: DailyCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = utcDayKey(new Date(now.getTime() - i * 86_400_000));
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

/**
 * Linear-interpolated percentile (p in 0..1) — the standard
 * "exclusive of nothing" estimator: index = (n-1)*p over the sorted
 * values, interpolating between neighbors. Returns null on empty input.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * Math.min(Math.max(p, 0), 1);
  const lo = sorted[Math.floor(idx)]!;
  const hi = sorted[Math.ceil(idx)]!;
  return lo + (hi - lo) * (idx - Math.floor(idx));
}

/** Median = 50th percentile. Null on empty input. */
export function median(values: number[]): number | null {
  return percentile(values, 0.5);
}

/** Coerce the `?days=` query param to the supported windows. */
export function parseDaysParam(raw: unknown): 7 | 30 | 90 {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (n === 7 || n === 90) return n;
  return 30;
}

import { describe, it, expect } from 'vitest';
import {
  fillDailySeries,
  median,
  percentile,
  parseDaysParam,
  utcDayKey,
} from '../lib/reports.js';

// Pure-function coverage for the /api/v1/reports helpers — no DB.

describe('fillDailySeries', () => {
  const now = new Date('2026-06-11T10:00:00Z');

  it('produces one entry per day, oldest first, ending today (UTC)', () => {
    const out = fillDailySeries([], 7, now);
    expect(out).toHaveLength(7);
    expect(out[0]!.day).toBe('2026-06-05');
    expect(out[6]!.day).toBe('2026-06-11');
    expect(out.every((r) => r.count === 0)).toBe(true);
  });

  it('fills gaps with zero and keeps real counts', () => {
    const out = fillDailySeries(
      [
        { day: '2026-06-06', count: 3 },
        { day: '2026-06-10', count: 1 },
      ],
      7,
      now,
    );
    expect(out.map((r) => r.count)).toEqual([0, 3, 0, 0, 0, 1, 0]);
  });

  it('drops rows outside the window', () => {
    const out = fillDailySeries([{ day: '2026-05-01', count: 99 }], 7, now);
    expect(out.reduce((a, r) => a + r.count, 0)).toBe(0);
  });

  it('handles month boundaries', () => {
    const out = fillDailySeries([], 3, new Date('2026-06-01T00:30:00Z'));
    expect(out.map((r) => r.day)).toEqual(['2026-05-30', '2026-05-31', '2026-06-01']);
  });

  it('supports the 30 and 90 day windows', () => {
    expect(fillDailySeries([], 30, now)).toHaveLength(30);
    expect(fillDailySeries([], 90, now)).toHaveLength(90);
    expect(fillDailySeries([], 90, now)[0]!.day).toBe('2026-03-14');
  });
});

describe('median / percentile', () => {
  it('returns null on empty input', () => {
    expect(median([])).toBeNull();
    expect(percentile([], 0.9)).toBeNull();
  });

  it('returns the value for a single element', () => {
    expect(median([42])).toBe(42);
    expect(percentile([42], 0.9)).toBe(42);
  });

  it('takes the middle of an odd-length set', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('interpolates the middle of an even-length set', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('does not mutate its input', () => {
    const v = [3, 1, 2];
    median(v);
    expect(v).toEqual([3, 1, 2]);
  });

  it('computes p90 with linear interpolation', () => {
    // 1..10 → idx = 9 * 0.9 = 8.1 → 9 + 0.1*(10-9) = 9.1
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
    // p0 / p100 are the extremes
    expect(percentile([4, 2, 8], 0)).toBe(2);
    expect(percentile([4, 2, 8], 1)).toBe(8);
  });
});

describe('parseDaysParam', () => {
  it('accepts the supported windows', () => {
    expect(parseDaysParam('7')).toBe(7);
    expect(parseDaysParam('30')).toBe(30);
    expect(parseDaysParam('90')).toBe(90);
  });

  it('defaults everything else to 30', () => {
    expect(parseDaysParam(undefined)).toBe(30);
    expect(parseDaysParam('14')).toBe(30);
    expect(parseDaysParam('abc')).toBe(30);
    expect(parseDaysParam(['90', '7'])).toBe(90); // first wins on arrays
  });
});

describe('utcDayKey', () => {
  it('formats the UTC calendar day', () => {
    expect(utcDayKey(new Date('2026-06-11T23:59:59Z'))).toBe('2026-06-11');
  });
});

import { describe, it, expect } from 'vitest';
import {
  isInsideBusinessHours,
  parseBusinessHours,
  parseHHMM,
  localParts,
  type BusinessHours,
} from '../lib/auto-response.js';

// Feature wave: CSAT + automation — business-hours evaluation.
// All fixed instants below are UTC; WIB = UTC+7 (Asia/Jakarta, no DST).

const WIB_9_TO_5: BusinessHours = {
  tz: 'Asia/Jakarta',
  days: [
    null, // Sun closed
    { dow: 1, open: '09:00', close: '17:00' },
    { dow: 2, open: '09:00', close: '17:00' },
    { dow: 3, open: '09:00', close: '17:00' },
    { dow: 4, open: '09:00', close: '17:00' },
    { dow: 5, open: '09:00', close: '17:00' },
    null, // Sat closed
  ],
};

// 2026-06-10 is a Wednesday.
const wibWed = (hhmm: string) => new Date(`2026-06-10T${hhmm}:00+07:00`);

describe('parseHHMM', () => {
  it('parses valid times', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('09:30')).toBe(570);
    expect(parseHHMM('23:59')).toBe(1439);
  });
  it('rejects malformed values', () => {
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('9:00')).toBeNull();
    expect(parseHHMM('09:60')).toBeNull();
    expect(parseHHMM(900 as unknown as string)).toBeNull();
  });
});

describe('localParts (WIB)', () => {
  it('converts UTC into Jakarta wall-clock', () => {
    // 2026-06-10 23:30 UTC = 2026-06-11 06:30 WIB (Thursday).
    const p = localParts(new Date('2026-06-10T23:30:00Z'), 'Asia/Jakarta');
    expect(p).toEqual({ dow: 4, minutes: 6 * 60 + 30 });
  });
  it('falls back to Asia/Jakarta on an unknown zone', () => {
    const a = localParts(new Date('2026-06-10T23:30:00Z'), 'Not/AZone');
    const b = localParts(new Date('2026-06-10T23:30:00Z'), 'Asia/Jakarta');
    expect(a).toEqual(b);
  });
});

describe('isInsideBusinessHours — standard WIB 9-to-5', () => {
  it('is inside mid-day', () => {
    expect(isInsideBusinessHours(WIB_9_TO_5, wibWed('12:00'))).toBe(true);
  });
  it('open boundary is inclusive, close boundary exclusive', () => {
    expect(isInsideBusinessHours(WIB_9_TO_5, wibWed('09:00'))).toBe(true);
    expect(isInsideBusinessHours(WIB_9_TO_5, wibWed('08:59'))).toBe(false);
    expect(isInsideBusinessHours(WIB_9_TO_5, wibWed('16:59'))).toBe(true);
    expect(isInsideBusinessHours(WIB_9_TO_5, wibWed('17:00'))).toBe(false);
  });
  it('closed days (null entries) are outside all day', () => {
    // 2026-06-14 is a Sunday in WIB.
    expect(isInsideBusinessHours(WIB_9_TO_5, new Date('2026-06-14T12:00:00+07:00'))).toBe(false);
  });

  it('evaluates in WIB, not UTC (the boundary case)', () => {
    // 03:00 UTC = 10:00 WIB Wednesday → inside, even though 03:00 UTC
    // "looks" like night.
    expect(isInsideBusinessHours(WIB_9_TO_5, new Date('2026-06-10T03:00:00Z'))).toBe(true);
    // 12:00 UTC = 19:00 WIB → outside, even though 12:00 UTC "looks"
    // like lunch time.
    expect(isInsideBusinessHours(WIB_9_TO_5, new Date('2026-06-10T12:00:00Z'))).toBe(false);
    // 23:00 UTC Tue = 06:00 WIB Wednesday → outside (before open) AND
    // on a different weekday than UTC says.
    expect(isInsideBusinessHours(WIB_9_TO_5, new Date('2026-06-09T23:00:00Z'))).toBe(false);
  });
});

describe('isInsideBusinessHours — overnight windows', () => {
  // Night shift: Mon + Tue 22:00 → 06:00 next morning.
  const NIGHT: BusinessHours = {
    tz: 'Asia/Jakarta',
    days: [
      null,
      { dow: 1, open: '22:00', close: '06:00' },
      { dow: 2, open: '22:00', close: '06:00' },
      null,
      null,
      null,
      null,
    ],
  };
  // 2026-06-08 = Monday, 2026-06-09 = Tuesday (WIB).
  it('inside after open on the start day', () => {
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-08T22:00:00+07:00'))).toBe(true);
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-08T23:30:00+07:00'))).toBe(true);
  });
  it('inside before close on the NEXT morning (spill-over)', () => {
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-09T01:00:00+07:00'))).toBe(true);
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-09T05:59:00+07:00'))).toBe(true);
  });
  it('outside between close and next open', () => {
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-09T06:00:00+07:00'))).toBe(false);
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-09T12:00:00+07:00'))).toBe(false);
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-08T21:59:00+07:00'))).toBe(false);
  });
  it('Wednesday early morning still covered by Tuesday overnight; Wednesday evening is not', () => {
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-10T03:00:00+07:00'))).toBe(true);
    expect(isInsideBusinessHours(NIGHT, new Date('2026-06-10T23:00:00+07:00'))).toBe(false);
  });
  it('zero-width window (open === close) is closed', () => {
    const z: BusinessHours = {
      tz: 'Asia/Jakarta',
      days: [null, { dow: 1, open: '09:00', close: '09:00' }, null, null, null, null, null],
    };
    expect(isInsideBusinessHours(z, new Date('2026-06-08T09:00:00+07:00'))).toBe(false);
  });
});

describe('isInsideBusinessHours — missing / malformed config', () => {
  it('treats no config as always inside', () => {
    expect(isInsideBusinessHours(null, wibWed('03:00'))).toBe(true);
    expect(isInsideBusinessHours(undefined, wibWed('03:00'))).toBe(true);
  });
  it('treats malformed config as always inside', () => {
    expect(isInsideBusinessHours({ nope: true }, wibWed('03:00'))).toBe(true);
    expect(
      isInsideBusinessHours(
        { tz: 'Asia/Jakarta', days: [{ dow: 9, open: 'x', close: 'y' }] },
        wibWed('03:00'),
      ),
    ).toBe(true);
  });
});

describe('parseBusinessHours', () => {
  it('round-trips a valid shape', () => {
    expect(parseBusinessHours(WIB_9_TO_5)).toEqual(WIB_9_TO_5);
  });
  it('rejects bad day entries', () => {
    expect(parseBusinessHours({ tz: 'Asia/Jakarta', days: [{ dow: 0, open: '09:00' }] })).toBeNull();
    expect(parseBusinessHours({ tz: 'Asia/Jakarta' })).toBeNull();
    expect(parseBusinessHours('Asia/Jakarta')).toBeNull();
  });
});

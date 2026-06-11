import { describe, it, expect } from 'vitest';
import { currentPeriod } from '../lib/usage.js';
import { brandingFooter } from '../lib/email.js';
import { tierDef } from '../lib/billing.js';

describe('currentPeriod (WIB month boundaries)', () => {
  it('formats YYYY-MM', () => {
    expect(currentPeriod(new Date('2026-06-11T10:00:00Z'))).toBe('2026-06');
  });
  it('rolls to the next month at WIB midnight, not UTC', () => {
    // 2026-06-30 17:30 UTC = 2026-07-01 00:30 WIB → July in Jakarta.
    expect(currentPeriod(new Date('2026-06-30T17:30:00Z'))).toBe('2026-07');
    // …while 16:30 UTC is still 23:30 WIB on June 30.
    expect(currentPeriod(new Date('2026-06-30T16:30:00Z'))).toBe('2026-06');
  });
});

describe('brandingFooter', () => {
  it('returns the powered-by footer when branding shown', () => {
    const f = brandingFooter(false);
    expect(f.html).toContain('Powered by Suppuo');
    expect(f.text).toContain('Powered by Suppuo');
  });
  it('returns empty strings when hidden', () => {
    expect(brandingFooter(true)).toEqual({ html: '', text: '' });
  });
});

describe('tier limits (machine-readable plan terms)', () => {
  it('agent seats match the marketing numbers', () => {
    expect(tierDef('gratis').agentLimit).toBe(2);
    expect(tierDef('warung').agentLimit).toBe(3);
    expect(tierDef('toko').agentLimit).toBe(10);
    expect(tierDef('bisnis').agentLimit).toBe(25);
  });
  it('WhatsApp is BYO-only — connected-number limits, no message quotas', () => {
    expect(tierDef('gratis').waNumberLimit).toBe(0);
    expect(tierDef('warung').waNumberLimit).toBe(1);
    expect(tierDef('toko').waNumberLimit).toBe(3);
    expect(tierDef('bisnis').waNumberLimit).toBeGreaterThan(3);
    // No platform-WA quota field — the shared number is dead (Meta).
    expect('waQuotaMonthly' in tierDef('warung')).toBe(false);
  });
});

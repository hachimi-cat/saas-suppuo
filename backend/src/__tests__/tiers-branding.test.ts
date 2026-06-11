import { describe, it, expect } from 'vitest';
import { brandingFooter } from '../lib/email.js';
import { tierDef, BILLING_TIERS } from '../lib/billing.js';

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

describe('tier definitions (English ids + machine-readable plan terms)', () => {
  it('tier ids are English', () => {
    expect([...BILLING_TIERS]).toEqual(['free', 'starter', 'growth', 'business']);
  });
  it('agent seats match the marketing numbers', () => {
    expect(tierDef('free').agentLimit).toBe(2);
    expect(tierDef('starter').agentLimit).toBe(3);
    expect(tierDef('growth').agentLimit).toBe(10);
    expect(tierDef('business').agentLimit).toBe(25);
  });
  it('WhatsApp is BYO-only — connected-number limits, no message quotas', () => {
    expect(tierDef('free').waNumberLimit).toBe(0);
    expect(tierDef('starter').waNumberLimit).toBe(1);
    expect(tierDef('growth').waNumberLimit).toBe(3);
    expect(tierDef('business').waNumberLimit).toBeGreaterThan(3);
    expect('waQuotaMonthly' in tierDef('starter')).toBe(false);
  });
});

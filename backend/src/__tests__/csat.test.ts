import { describe, it, expect } from 'vitest';
import { isValidCsatScore } from '../lib/csat.js';

// Feature wave: CSAT + automation — score validation.
// 1 = 😞, 2 = 😐, 3 = 😊. Anything else is rejected at the API edge.

describe('isValidCsatScore', () => {
  it('accepts 1, 2, 3', () => {
    expect(isValidCsatScore(1)).toBe(true);
    expect(isValidCsatScore(2)).toBe(true);
    expect(isValidCsatScore(3)).toBe(true);
  });

  it('rejects out-of-range integers', () => {
    expect(isValidCsatScore(0)).toBe(false);
    expect(isValidCsatScore(4)).toBe(false);
    expect(isValidCsatScore(-1)).toBe(false);
  });

  it('rejects non-integers and non-numbers', () => {
    expect(isValidCsatScore(1.5)).toBe(false);
    expect(isValidCsatScore('2')).toBe(false);
    expect(isValidCsatScore(null)).toBe(false);
    expect(isValidCsatScore(undefined)).toBe(false);
    expect(isValidCsatScore(NaN)).toBe(false);
  });
});

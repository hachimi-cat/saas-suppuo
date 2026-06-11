import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  buildWebhookSignature,
  verifyWebhookSignature,
  generateWebhookSecret,
  SIGNATURE_HEADER,
} from '../lib/webhook-signature.js';
import { subscriptionMatchesType } from '../services/outbox-worker.js';

const SECRET = 'whsec_0123456789abcdef';
const BODY = JSON.stringify({
  id: 'evt_01htest',
  type: 'suppuo.ticket.created.v1',
  occurredAt: '2026-06-11T00:00:00.000Z',
  data: { ticketId: 'tkt_01htest' },
});

describe('buildWebhookSignature', () => {
  it('produces t=<unix>,v1=<hex> (family HMAC convention)', () => {
    const sig = buildWebhookSignature(SECRET, BODY, 1765411200);
    expect(sig).toMatch(/^t=1765411200,v1=[0-9a-f]{64}$/);
  });

  it('v1 = hmac-sha256(secret, t + "." + body)', () => {
    const t = 1765411200;
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${t}.${BODY}`)
      .digest('hex');
    expect(buildWebhookSignature(SECRET, BODY, t)).toBe(`t=${t},v1=${expected}`);
  });

  it('defaults the timestamp to now', () => {
    const before = Math.floor(Date.now() / 1000);
    const sig = buildWebhookSignature(SECRET, BODY);
    const t = Number(sig.match(/^t=(\d+),/)?.[1]);
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(before + 2);
  });

  it('header name is the Suppuo flavor of the family scheme', () => {
    expect(SIGNATURE_HEADER).toBe('Suppuo-Signature');
  });
});

describe('verifyWebhookSignature', () => {
  const t = 1765411200;
  const sig = buildWebhookSignature(SECRET, BODY, t);

  it('round-trips a signature built by buildWebhookSignature', () => {
    expect(verifyWebhookSignature(SECRET, BODY, sig, { now: t })).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature(SECRET, BODY + 'x', sig, { now: t })).toBe(false);
  });

  it('rejects the wrong secret', () => {
    expect(verifyWebhookSignature('whsec_other', BODY, sig, { now: t })).toBe(false);
  });

  it('rejects stale timestamps beyond tolerance', () => {
    expect(verifyWebhookSignature(SECRET, BODY, sig, { now: t + 301 })).toBe(false);
    expect(verifyWebhookSignature(SECRET, BODY, sig, { now: t + 299 })).toBe(true);
  });

  it('rejects malformed headers', () => {
    expect(verifyWebhookSignature(SECRET, BODY, 'nonsense', { now: t })).toBe(false);
    expect(verifyWebhookSignature(SECRET, BODY, 't=abc,v1=', { now: t })).toBe(false);
  });
});

describe('generateWebhookSecret', () => {
  it('mints whsec_<48hex> secrets, uniquely', () => {
    const s = generateWebhookSecret();
    expect(s).toMatch(/^whsec_[0-9a-f]{48}$/);
    expect(generateWebhookSecret()).not.toBe(s);
  });
});

describe('subscriptionMatchesType', () => {
  it('"*" matches everything', () => {
    expect(subscriptionMatchesType(['*'], 'suppuo.ticket.created.v1')).toBe(true);
  });
  it('exact type match', () => {
    expect(
      subscriptionMatchesType(['suppuo.ticket.replied.v1'], 'suppuo.ticket.replied.v1'),
    ).toBe(true);
    expect(
      subscriptionMatchesType(['suppuo.ticket.replied.v1'], 'suppuo.ticket.created.v1'),
    ).toBe(false);
  });
  it('non-array events Json never matches', () => {
    expect(subscriptionMatchesType('*', 'suppuo.ticket.created.v1')).toBe(false);
    expect(subscriptionMatchesType(null, 'suppuo.ticket.created.v1')).toBe(false);
  });
});

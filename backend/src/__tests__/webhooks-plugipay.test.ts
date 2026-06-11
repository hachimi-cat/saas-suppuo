import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../app.js';

/*
 * Webhook route test — runs the full Express stack (raw-body capture
 * via the json parser's verify hook + the SDK's HMAC verification)
 * with prisma mocked, so no live DB is needed.
 *
 * Signature scheme (must match what Plugipay actually sends — same as
 * pawpado's webhook route): HMAC-SHA256 over `${timestamp}.${rawBody}`
 * delivered as `X-Plugipay-Signature: t=<ts>,v1=<hex>`.
 */

const appliedSessionIds = new Set<string>();
const upsert = vi.fn(async (args: { create: { id: string } }) => ({ id: args.create.id }));
const outboxCreate = vi.fn(async () => ({}));

vi.mock('../lib/db.js', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        billingSubscription: {
          findFirst: async (args: { where: { plugipayCheckoutSessionId: string } }) =>
            appliedSessionIds.has(args.where.plugipayCheckoutSessionId)
              ? { id: 'bsub_existing' }
              : null,
          upsert: async (args: { create: { id: string; plugipayCheckoutSessionId: string } }) => {
            appliedSessionIds.add(args.create.plugipayCheckoutSessionId);
            return upsert(args);
          },
        },
        outboxEvent: { create: outboxCreate },
      }),
  },
}));

const SECRET = 'whsec_test_suppuo';

function sign(rawBody: string, secret = SECRET, ts = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return `t=${ts},v1=${v1}`;
}

function completedEvent(sessionId: string, metadata: Record<string, string>): string {
  return JSON.stringify({
    type: 'plugipay.checkout_session.completed.v1',
    id: `evt_${sessionId}`,
    accountId: 'acc_plugipay_merchant',
    occurredAt: new Date().toISOString(),
    data: { object: { id: sessionId, metadata } },
  });
}

beforeEach(() => {
  process.env.PLUGIPAY_WEBHOOK_SECRET = SECRET;
  appliedSessionIds.clear();
  upsert.mockClear();
  outboxCreate.mockClear();
});

describe('POST /api/v1/webhooks/plugipay', () => {
  it('rejects a missing signature', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/webhooks/plugipay')
      .set('Content-Type', 'application/json')
      .send(completedEvent('cs_1', { accountId: 'acc_1', tier: 'warung' }));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('signature_missing');
  });

  it('rejects a bad signature', async () => {
    const app = createApp();
    const body = completedEvent('cs_1', { accountId: 'acc_1', tier: 'warung' });
    const res = await request(app)
      .post('/api/v1/webhooks/plugipay')
      .set('Content-Type', 'application/json')
      .set('X-Plugipay-Signature', sign(body, 'whsec_wrong'))
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('signature_invalid');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('applies a signed completed checkout, then no-ops the replay (idempotent)', async () => {
    const app = createApp();
    const body = completedEvent('cs_42', { accountId: 'acc_1', tier: 'toko' });

    const first = await request(app)
      .post('/api/v1/webhooks/plugipay')
      .set('Content-Type', 'application/json')
      .set('X-Plugipay-Signature', sign(body))
      .send(body);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ received: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(outboxCreate).toHaveBeenCalledTimes(1);

    const replay = await request(app)
      .post('/api/v1/webhooks/plugipay')
      .set('Content-Type', 'application/json')
      .set('X-Plugipay-Signature', sign(body))
      .send(body);
    expect(replay.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(1); // unchanged
    expect(outboxCreate).toHaveBeenCalledTimes(1); // unchanged
  });

  it('acks (200) but ignores a completed session without suppuo metadata', async () => {
    const app = createApp();
    const body = completedEvent('cs_other', {});
    const res = await request(app)
      .post('/api/v1/webhooks/plugipay')
      .set('Content-Type', 'application/json')
      .set('X-Plugipay-Signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });
});

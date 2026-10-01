import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

/*
 * Webhook delivery against a real Postgres (CI's service container; locally
 * DATABASE_URL) and a real HTTP receiver on 127.0.0.1: fan-out, signing,
 * the retry schedule, the lease, auto-disable, the SSRF guard, the delivery
 * log routes and the event catalogue.
 */
const HAS_DB = !!process.env.DATABASE_URL;

type Received = { headers: http.IncomingHttpHeaders; body: string };

describe.skipIf(!HAS_DB)('webhook delivery', async () => {
  const { prisma } = await import('../lib/db.js');
  const { createApp } = await import('../app.js');
  const { generateApiKey } = await import('../lib/api-keys.js');
  const { newId } = await import('../lib/ids.js');
  const { verifyWebhookSignature } = await import('../lib/webhook-signature.js');
  const { EVENT_TYPES } = await import('../lib/event-types.js');
  const wd = await import('../services/webhook-delivery.js');

  let server: http.Server;
  let base = '';
  const received: Received[] = [];
  let statuses: number[] = [];
  const app = createApp();

  const A = `acc_wh_${Date.now()}`;
  const B = `acc_wh_other_${Date.now()}`;
  let keyA = '';

  async function sub(accountId: string, events: unknown = ['*'], extra: Record<string, unknown> = {}) {
    return prisma.webhookSubscription.create({
      data: { id: newId('whs'), accountId, url: `${base}/hook`, secret: 'whsec_test', events: events as never, ...extra },
    });
  }
  function event(accountId: string | null, type = 'suppuo.ticket.created.v1', occurredAt = new Date()) {
    return { id: newId('evt'), type, accountId, occurredAt, data: { ticketId: 'tkt_x', number: 1 } };
  }

  beforeAll(async () => {
    process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS = 'true';
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ headers: req.headers, body });
        res.statusCode = statuses.length ? statuses.shift()! : 200;
        res.end('ok');
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const k = generateApiKey();
    keyA = k.plaintext;
    await prisma.apiKey.create({ data: { id: newId('ak'), accountId: A, name: 'test', keyPrefix: k.keyPrefix, keyHash: k.keyHash } });
  });

  afterAll(async () => {
    await prisma.webhookSubscription.deleteMany({ where: { accountId: { in: [A, B] } } });
    await prisma.outboxEvent.deleteMany({ where: { accountId: { in: [A, B] } } });
    await prisma.apiKey.deleteMany({ where: { accountId: A } });
    await new Promise<void>((r) => server.close(() => r()));
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    received.length = 0;
    statuses = [];
    process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS = 'true';
    await prisma.webhookSubscription.deleteMany({ where: { accountId: { in: [A, B] } } });
    await prisma.outboxEvent.deleteMany({ where: { accountId: { in: [A, B] } } });
  });

  it('fans out to every matching active subscription of the event’s workspace, once', async () => {
    const all = await sub(A, ['*']);
    const exact = await sub(A, ['suppuo.ticket.created.v1']);
    const prefix = await sub(A, ['suppuo.ticket.*']);
    await sub(A, ['suppuo.ticket.replied.v1']);
    await sub(A, ['*'], { active: false });
    await sub(B, ['*']);
    const ev = event(A);
    await sub(A, ['*'], { createdAt: new Date(ev.occurredAt.getTime() + 60_000) }); // made after the event
    expect(await wd.queueWebhookDeliveries(ev)).toBe(3);
    expect(await wd.queueWebhookDeliveries(ev)).toBe(0); // idempotent
    const rows = await prisma.webhookDelivery.findMany({ where: { eventId: ev.id } });
    expect(rows.map((r) => r.subscriptionId).sort()).toEqual([all.id, exact.id, prefix.id].sort());
    expect(rows.every((r) => r.body === wd.webhookBody(ev))).toBe(true);
    expect(await wd.queueWebhookDeliveries(event(null))).toBe(0);
  });

  it('signs every request and sends the delivery headers', async () => {
    const s = await sub(A);
    const ev = event(A);
    await wd.queueWebhookDeliveries(ev);
    expect(await wd.deliverDueWebhooks()).toBe(1);
    expect(received).toHaveLength(1);
    const r = received[0]!;
    expect(r.body).toBe(wd.webhookBody(ev));
    expect(verifyWebhookSignature('whsec_test', r.body, String(r.headers['suppuo-signature']))).toBe(true);
    expect(r.headers['suppuo-event-id']).toBe(ev.id);
    expect(r.headers['suppuo-event-type']).toBe(ev.type);
    expect(r.headers['suppuo-delivery-attempt']).toBe('1');
    const d = await prisma.webhookDelivery.findFirstOrThrow({ where: { subscriptionId: s.id }, include: { attemptLog: true } });
    expect(r.headers['suppuo-delivery-id']).toBe(d.id);
    expect(d.status).toBe('succeeded');
    expect(d.attemptLog).toHaveLength(1);
    expect(d.attemptLog[0]!.status).toBe('succeeded');
  });

  it('retries 1 min, 5 min, 25 min, 2 h and 12 h later, then gives up', async () => {
    const s = await sub(A);
    await wd.queueWebhookDeliveries(event(A));
    statuses = Array(10).fill(503);
    let now = new Date();
    for (let attempt = 1; attempt <= wd.MAX_ATTEMPTS; attempt++) {
      expect(await wd.deliverDueWebhooks({ now })).toBe(1);
      const d = await prisma.webhookDelivery.findFirstOrThrow({ where: { subscriptionId: s.id } });
      expect(d.attempts).toBe(attempt);
      if (attempt < wd.MAX_ATTEMPTS) {
        expect(d.status).toBe('pending');
        expect(d.nextRetryAt!.getTime() - now.getTime()).toBe(wd.RETRY_DELAYS_MS[attempt - 1]);
        // not due a moment before
        expect(await wd.deliverDueWebhooks({ now: new Date(d.nextRetryAt!.getTime() - 1000) })).toBe(0);
        now = d.nextRetryAt!;
      } else {
        expect(d.status).toBe('failed');
        expect(d.nextRetryAt).toBeNull();
        expect(d.lastError).toBe('HTTP 503');
      }
    }
    const attempts = await prisma.webhookDeliveryAttempt.findMany({ where: { subscriptionId: s.id }, orderBy: { attemptNumber: 'asc' } });
    expect(attempts.map((a) => a.attemptNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(attempts.every((a) => a.status === 'failed' && a.responseCode === 503)).toBe(true);
  });

  it('never sends a claimed delivery twice (two pollers at once)', async () => {
    await sub(A);
    await wd.queueWebhookDeliveries(event(A));
    const [a, b] = await Promise.all([wd.deliverDueWebhooks(), wd.deliverDueWebhooks()]);
    expect(a + b).toBe(1);
    expect(received).toHaveLength(1);
  });

  it('switches a subscription off after 20 failures in a row AND 24 h failing, and tells the workspace', async () => {
    const hour = 60 * 60 * 1000;
    const young = await sub(A, ['*'], { consecutiveFailures: 19, failingSince: new Date(Date.now() - hour) });
    await wd.queueWebhookDeliveries(event(A));
    statuses = [500];
    await wd.deliverDueWebhooks({ now: new Date(Date.now() + 1000) });
    expect((await prisma.webhookSubscription.findUniqueOrThrow({ where: { id: young.id } })).active).toBe(true);
    await prisma.webhookSubscription.delete({ where: { id: young.id } });

    const old = await sub(A, ['*'], { consecutiveFailures: 19, failingSince: new Date(Date.now() - 25 * hour) });
    const other = await sub(A, ['suppuo.webhook_subscription.*']);
    const ev1 = event(A, 'suppuo.ticket.created.v1');
    await wd.queueWebhookDeliveries(ev1);
    const ev2 = event(A, 'suppuo.ticket.replied.v1');
    await wd.queueWebhookDeliveries(ev2);
    statuses = [500];
    await wd.deliverDueWebhooks({ now: new Date(Date.now() + 1000), limit: 1 });
    const off = await prisma.webhookSubscription.findUniqueOrThrow({ where: { id: old.id } });
    expect(off.active).toBe(false);
    expect(off.disabledAt).not.toBeNull();
    expect(off.disabledReason).toMatch(/20 consecutive failed deliveries since/);
    const left = await prisma.webhookDelivery.findMany({ where: { subscriptionId: old.id } });
    expect(left.every((d) => d.status === 'failed')).toBe(true);
    const notice = await prisma.outboxEvent.findFirstOrThrow({ where: { accountId: A, type: 'suppuo.webhook_subscription.disabled.v1' } });
    expect((notice.data as { id: string }).id).toBe(old.id);
    // the notice reaches the workspace's other subscription, not the switched-off one
    expect(await wd.queueWebhookDeliveries({ ...notice, data: notice.data })).toBe(1);
    expect((await prisma.webhookDelivery.findFirstOrThrow({ where: { eventId: notice.id } })).subscriptionId).toBe(other.id);
  });

  it('a success resets the failure streak', async () => {
    const s = await sub(A, ['*'], { consecutiveFailures: 7, failingSince: new Date(Date.now() - 3600_000) });
    await wd.queueWebhookDeliveries(event(A));
    await wd.deliverDueWebhooks();
    const after = await prisma.webhookSubscription.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.consecutiveFailures).toBe(0);
    expect(after.failingSince).toBeNull();
  });

  it('refuses private targets unless explicitly allowed (SSRF guard)', async () => {
    delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;
    const s = await sub(A);
    await wd.queueWebhookDeliveries(event(A));
    await wd.deliverDueWebhooks();
    expect(received).toHaveLength(0);
    const d = await prisma.webhookDelivery.findFirstOrThrow({ where: { subscriptionId: s.id } });
    expect(d.lastError).toMatch(/^blocked:/);
    const res = await request(app)
      .post('/api/v1/webhook-subscriptions')
      .set('Authorization', `Bearer ${keyA}`)
      .send({ url: 'http://127.0.0.1:9/hook' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/url: blocked/);
  });

  it('serves the delivery log, scoped to the workspace, and retries', async () => {
    const s = await sub(A);
    const theirs = await sub(B);
    await wd.queueWebhookDeliveries(event(A));
    await wd.queueWebhookDeliveries(event(B));
    statuses = [500, 500];
    await wd.deliverDueWebhooks();
    const auth = { Authorization: `Bearer ${keyA}` };

    const list = await request(app).get('/api/v1/webhook-subscriptions/deliveries?limit=1').set(auth);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].subscriptionId).toBe(s.id);
    expect(list.body.data[0].attemptLog).toHaveLength(1);
    const id = list.body.data[0].id as string;

    const filtered = await request(app).get('/api/v1/webhook-subscriptions/deliveries?status=succeeded').set(auth);
    expect(filtered.body.data).toHaveLength(0);

    const one = await request(app).get(`/api/v1/webhook-subscriptions/deliveries/${id}`).set(auth);
    expect(one.status).toBe(200);
    expect(one.body.data.status).toBe('pending');

    // already queued (its retry is scheduled)
    expect((await request(app).post(`/api/v1/webhook-subscriptions/deliveries/${id}/retry`).set(auth)).status).toBe(409);

    await prisma.webhookDelivery.update({ where: { id }, data: { status: 'failed', nextRetryAt: null } });
    const retried = await request(app).post(`/api/v1/webhook-subscriptions/deliveries/${id}/retry`).set(auth);
    expect(retried.status).toBe(202);
    expect(retried.body.data.status).toBe('pending');
    await wd.deliverDueWebhooks();
    expect((await prisma.webhookDelivery.findUniqueOrThrow({ where: { id } })).status).toBe('succeeded');

    // another workspace's delivery is not found
    const foreign = await prisma.webhookDelivery.findFirstOrThrow({ where: { subscriptionId: theirs.id } });
    expect((await request(app).get(`/api/v1/webhook-subscriptions/deliveries/${foreign.id}`).set(auth)).status).toBe(404);
    expect((await request(app).post(`/api/v1/webhook-subscriptions/deliveries/${foreign.id}/retry`).set(auth)).status).toBe(404);

    // pausing fails what is queued; a retry then needs it re-enabled
    await wd.queueWebhookDeliveries(event(A, 'suppuo.ticket.replied.v1'));
    const paused = await request(app).patch(`/api/v1/webhook-subscriptions/${s.id}`).set(auth).send({ active: false });
    expect(paused.status).toBe(200);
    expect(await prisma.webhookDelivery.count({ where: { subscriptionId: s.id, status: 'pending' } })).toBe(0);
    expect((await request(app).post(`/api/v1/webhook-subscriptions/deliveries/${id}/retry`).set(auth)).status).toBe(409);
  });

  it('PATCH active:true re-enables a switched-off subscription and clears its streak', async () => {
    const s = await sub(A, ['*'], {
      active: false, consecutiveFailures: 20, failingSince: new Date(), disabledAt: new Date(), disabledReason: 'x',
    });
    const res = await request(app)
      .patch(`/api/v1/webhook-subscriptions/${s.id}`)
      .set('Authorization', `Bearer ${keyA}`)
      .send({ active: true, events: ['suppuo.ticket.*'] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      active: true, consecutiveFailures: 0, failingSince: null, disabledAt: null, disabledReason: null, events: ['suppuo.ticket.*'],
    });
  });

  it('prunes finished deliveries after the retention window, never pending ones', async () => {
    const s = await sub(A);
    await wd.queueWebhookDeliveries(event(A));
    await wd.queueWebhookDeliveries(event(A, 'suppuo.ticket.replied.v1'));
    const [done, waiting] = await prisma.webhookDelivery.findMany({ where: { subscriptionId: s.id }, orderBy: { type: 'asc' } });
    const old = new Date(Date.now() - (wd.RETENTION_DAYS + 1) * 86_400_000);
    await prisma.webhookDelivery.update({ where: { id: done!.id }, data: { status: 'succeeded', createdAt: old } });
    await prisma.webhookDelivery.update({ where: { id: waiting!.id }, data: { createdAt: old } });
    expect(await wd.pruneOldDeliveries()).toBeGreaterThanOrEqual(1);
    expect(await prisma.webhookDelivery.count({ where: { id: done!.id } })).toBe(0);
    expect(await prisma.webhookDelivery.count({ where: { id: waiting!.id } })).toBe(1);
  });

  it('the event catalogue lists every type the code emits, and the docs list the catalogue', async () => {
    const res = await request(app).get('/api/v1/webhook-subscriptions/event-types').set('Authorization', `Bearer ${keyA}`);
    expect(res.status).toBe(200);
    const listed = (res.body.data.types as { type: string }[]).map((t) => t.type).sort();
    expect(listed).toEqual(EVENT_TYPES.map((t) => t.type).sort());

    const src = path.resolve(__dirname, '..');
    const emitted = new Set<string>();
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) { if (f.name !== '__tests__') walk(p); continue; }
        if (!p.endsWith('.ts')) continue;
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/type:\s*'(suppuo\.[a-z_.]+\.v\d+)'/g)) emitted.add(m[1]!);
      }
    };
    walk(src);
    expect(emitted.size).toBeGreaterThan(0);
    for (const t of emitted) expect(listed).toContain(t);

    const docs = fs.readFileSync(path.resolve(__dirname, '../../../copy/docs/webhooks.md'), 'utf8');
    for (const t of listed) expect(docs).toContain(`\`${t}\``);
  });

  it('the production entrypoint starts the delivery worker', () => {
    const index = fs.readFileSync(path.resolve(__dirname, '../index.ts'), 'utf8');
    expect(index).toMatch(/startWebhookDeliveryWorker\(\)/);
  });
});

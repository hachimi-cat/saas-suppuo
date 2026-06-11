import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import request from 'supertest';

/*
 * Route test for /api/v1/webhooks/whatsapp-cloud — full Express stack
 * (raw-body capture + routing) with prisma + the ticket ingest mocked.
 */

process.env.SUPPUO_CHANNEL_KEY = randomBytes(32).toString('hex');

const integrations: Array<{
  id: string;
  accountId: string;
  provider: string;
  externalId: string;
  status: string;
  credentials: string;
  config: Record<string, unknown>;
}> = [];

vi.mock('../lib/db.js', () => ({
  prisma: {
    channelIntegration: {
      findMany: async (args: { where: { provider: string; status: string } }) =>
        integrations.filter(
          (i) => i.provider === args.where.provider && i.status === args.where.status,
        ),
    },
  },
}));

const ingest = vi.fn(async () => ({ ticketId: 'tkt_1', created: true }));
vi.mock('../lib/ticket-ingest.js', () => ({
  ingestInboundPhoneMessage: (...args: unknown[]) => ingest(...(args as [])),
}));

const { createApp } = await import('../app.js');
const { encryptCredentials } = await import('../lib/channel-crypto.js');

const APP_SECRET = 'meta_app_secret_xyz';
const VERIFY_TOKEN = 'suppuo_verify_abc123def456';
const PHONE_NUMBER_ID = '106540352242922';

function seedIntegration(opts: { appSecret?: string } = {}) {
  integrations.length = 0;
  integrations.push({
    id: 'chn_1',
    accountId: 'acc_workspace_1',
    provider: 'whatsapp_cloud',
    externalId: '+6281234567890',
    status: 'active',
    credentials: encryptCredentials({
      accessToken: 'EAAGtoken',
      ...(opts.appSecret ? { appSecret: opts.appSecret } : {}),
    }),
    config: { phoneNumberId: PHONE_NUMBER_ID, verifyToken: VERIFY_TOKEN },
  });
}

function inboundBody(): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '102290129340398',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '6281234567890',
                phone_number_id: PHONE_NUMBER_ID,
              },
              contacts: [{ profile: { name: 'Budi' }, wa_id: '628111222333' }],
              messages: [
                {
                  from: '628111222333',
                  id: 'wamid.TEST1',
                  timestamp: '1749600000',
                  text: { body: 'Halo, butuh bantuan' },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  });
}

beforeEach(() => {
  ingest.mockClear();
  seedIntegration();
});

describe('GET /api/v1/webhooks/whatsapp-cloud (Meta handshake)', () => {
  it('echoes hub.challenge when the verify token matches an active integration', async () => {
    const res = await request(createApp()).get('/api/v1/webhooks/whatsapp-cloud').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': '1158201444',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('1158201444');
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('403s on an unknown verify token', async () => {
    const res = await request(createApp()).get('/api/v1/webhooks/whatsapp-cloud').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token',
      'hub.challenge': '1158201444',
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/webhooks/whatsapp-cloud (message events)', () => {
  it('ingests an inbound text into the ticket flow and ACKs 200', async () => {
    const res = await request(createApp())
      .post('/api/v1/webhooks/whatsapp-cloud')
      .set('Content-Type', 'application/json')
      .send(inboundBody());
    expect(res.status).toBe(200);
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledWith({
      accountId: 'acc_workspace_1',
      phone: '+628111222333',
      name: 'Budi',
      body: 'Halo, butuh bantuan',
      channel: 'whatsapp',
    });
  });

  it('verifies X-Hub-Signature-256 when an appSecret is stored', async () => {
    seedIntegration({ appSecret: APP_SECRET });
    const body = inboundBody();
    const sig = 'sha256=' + createHmac('sha256', APP_SECRET).update(body, 'utf8').digest('hex');

    const ok = await request(createApp())
      .post('/api/v1/webhooks/whatsapp-cloud')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sig)
      .send(body);
    expect(ok.status).toBe(200);
    expect(ingest).toHaveBeenCalledTimes(1);

    ingest.mockClear();
    const bad = await request(createApp())
      .post('/api/v1/webhooks/whatsapp-cloud')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'sha256=' + 'ab'.repeat(32))
      .send(body);
    expect(bad.status).toBe(200); // still ACKs — Meta retries on non-2xx
    expect(ingest).not.toHaveBeenCalled(); // but the delivery is dropped
  });

  it('ACKs 200 for unknown phone_number_id and for status deliveries', async () => {
    integrations.length = 0; // no integrations at all
    const unknown = await request(createApp())
      .post('/api/v1/webhooks/whatsapp-cloud')
      .set('Content-Type', 'application/json')
      .send(inboundBody());
    expect(unknown.status).toBe(200);
    expect(ingest).not.toHaveBeenCalled();

    seedIntegration();
    const statuses = await request(createApp())
      .post('/api/v1/webhooks/whatsapp-cloud')
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          object: 'whatsapp_business_account',
          entry: [
            {
              id: '102290129340398',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: { phone_number_id: PHONE_NUMBER_ID },
                    statuses: [{ id: 'wamid.X', status: 'read', recipient_id: '628111222333' }],
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        }),
      );
    expect(statuses.status).toBe(200);
    expect(ingest).not.toHaveBeenCalled();
  });
});

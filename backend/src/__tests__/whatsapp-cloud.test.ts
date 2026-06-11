import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  parseCloudInboundMessages,
  verifyMetaSignature,
  generateVerifyToken,
} from '../lib/whatsapp-cloud.js';

/*
 * Meta WhatsApp Cloud API webhook payload parsing — fixtures shaped
 * exactly like the Graph API "messages" field deliveries (v21.0 docs:
 * object=whatsapp_business_account, entry[].changes[].value with
 * messaging_product/metadata/contacts/messages or statuses).
 */

/** Real-shaped inbound text delivery. */
const inboundTextFixture = {
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
              phone_number_id: '106540352242922',
            },
            contacts: [
              {
                profile: { name: 'Budi Santoso' },
                wa_id: '628111222333',
              },
            ],
            messages: [
              {
                from: '628111222333',
                id: 'wamid.HBgLNjI4MTExMjIyMzMzFQIAEhggQUJDREVGMDEyMzQ1Njc4OTo=',
                timestamp: '1749600000',
                text: { body: 'Halo, pesanan saya belum sampai\nNomor order #1234' },
                type: 'text',
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

/** Real-shaped status (delivery receipt) delivery — must be ignored. */
const statusFixture = {
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
              phone_number_id: '106540352242922',
            },
            statuses: [
              {
                id: 'wamid.HBgLNjI4MTExMjIyMzMzFQIAEhggREVMSVZFUkVE',
                status: 'delivered',
                timestamp: '1749600100',
                recipient_id: '628111222333',
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

describe('parseCloudInboundMessages', () => {
  it('extracts an inbound text message with E.164 + profile name', () => {
    const msgs = parseCloudInboundMessages(inboundTextFixture);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({
      phoneNumberId: '106540352242922',
      from: '+628111222333', // + prefix added — matches requesterPhone storage
      profileName: 'Budi Santoso',
      body: 'Halo, pesanan saya belum sampai\nNomor order #1234',
      messageId: 'wamid.HBgLNjI4MTExMjIyMzMzFQIAEhggQUJDREVGMDEyMzQ1Njc4OTo=',
    });
  });

  it('ignores status/read-receipt deliveries', () => {
    expect(parseCloudInboundMessages(statusFixture)).toHaveLength(0);
  });

  it('skips non-text message types', () => {
    const fixture = structuredClone(inboundTextFixture) as {
      entry: Array<{ changes: Array<{ value: { messages: Array<Record<string, unknown>> } }> }>;
    };
    fixture.entry[0]!.changes[0]!.value.messages[0] = {
      from: '628111222333',
      id: 'wamid.IMG',
      timestamp: '1749600000',
      type: 'image',
      image: { id: '12345', mime_type: 'image/jpeg' },
    };
    expect(parseCloudInboundMessages(fixture)).toHaveLength(0);
  });

  it('handles multiple messages in one delivery', () => {
    const fixture = structuredClone(inboundTextFixture) as {
      entry: Array<{ changes: Array<{ value: { messages: Array<Record<string, unknown>> } }> }>;
    };
    fixture.entry[0]!.changes[0]!.value.messages.push({
      from: '628999888777',
      id: 'wamid.SECOND',
      timestamp: '1749600050',
      text: { body: 'Saya juga mau tanya' },
      type: 'text',
    });
    const msgs = parseCloudInboundMessages(fixture);
    expect(msgs).toHaveLength(2);
    expect(msgs[1]!.from).toBe('+628999888777');
    expect(msgs[1]!.profileName).toBeNull(); // no contacts[] entry for it
  });

  it('never throws on malformed payloads', () => {
    for (const weird of [null, undefined, 'string', 42, {}, { entry: 'nope' }, { entry: [{}] }, { entry: [{ changes: [{ value: null }] }] }]) {
      expect(parseCloudInboundMessages(weird)).toEqual([]);
    }
  });
});

describe('verifyMetaSignature', () => {
  const secret = 'meta_app_secret_test';
  const raw = JSON.stringify(inboundTextFixture);
  const good = 'sha256=' + createHmac('sha256', secret).update(raw, 'utf8').digest('hex');

  it('accepts a valid X-Hub-Signature-256', () => {
    expect(verifyMetaSignature(raw, good, secret)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(verifyMetaSignature(raw, good, 'other_secret')).toBe(false);
  });

  it('rejects a tampered body', () => {
    expect(verifyMetaSignature(raw + ' ', good, secret)).toBe(false);
  });

  it('rejects missing or malformed headers', () => {
    expect(verifyMetaSignature(raw, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(raw, 'sha1=abc', secret)).toBe(false);
    expect(verifyMetaSignature(raw, 'sha256=deadbeef', secret)).toBe(false);
  });
});

describe('generateVerifyToken', () => {
  it('generates unique unguessable tokens', () => {
    const a = generateVerifyToken();
    const b = generateVerifyToken();
    expect(a).toMatch(/^suppuo_verify_[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

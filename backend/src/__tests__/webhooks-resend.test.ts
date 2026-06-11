import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  verifySvixSignature,
  accountIdFromAddress,
  isLikelyAccountId,
  trimQuotedReply,
} from '../routes/webhooks-resend.js';

const SECRET_RAW = crypto.randomBytes(24);
const SECRET = `whsec_${SECRET_RAW.toString('base64')}`;

function sign(id: string, ts: string, body: string): string {
  return (
    'v1,' +
    crypto.createHmac('sha256', SECRET_RAW).update(`${id}.${ts}.${body}`).digest('base64')
  );
}

describe('verifySvixSignature', () => {
  const now = String(Math.floor(Date.now() / 1000));

  it('accepts a valid v1 signature', () => {
    const body = '{"type":"email.received"}';
    const ok = verifySvixSignature(
      body,
      { id: 'msg_1', timestamp: now, signature: sign('msg_1', now, body) },
      SECRET,
    );
    expect(ok).toBe(true);
  });

  it('accepts when valid sig is among multiple space-separated entries', () => {
    const body = '{}';
    const sig = `v1,${Buffer.alloc(32).toString('base64')} ${sign('m', now, body)}`;
    expect(verifySvixSignature(body, { id: 'm', timestamp: now, signature: sig }, SECRET)).toBe(
      true,
    );
  });

  it('rejects a tampered body', () => {
    const sig = sign('msg_1', now, '{"a":1}');
    expect(
      verifySvixSignature('{"a":2}', { id: 'msg_1', timestamp: now, signature: sig }, SECRET),
    ).toBe(false);
  });

  it('rejects stale timestamps (replay)', () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const body = '{}';
    expect(
      verifySvixSignature(body, { id: 'm', timestamp: old, signature: sign('m', old, body) }, SECRET),
    ).toBe(false);
  });

  it('rejects when secret/headers missing', () => {
    expect(verifySvixSignature('{}', { id: 'm', timestamp: now, signature: 'v1,x' }, '')).toBe(
      false,
    );
    expect(verifySvixSignature('{}', { timestamp: now, signature: 'v1,x' }, SECRET)).toBe(false);
  });
});

describe('accountIdFromAddress', () => {
  it('extracts the accountId local-part', () => {
    expect(accountIdFromAddress('acc_01kphfwpgdayh9wg7kyy36kf58@in.suppuo.com')).toBe(
      'acc_01kphfwpgdayh9wg7kyy36kf58',
    );
  });
  it('tolerates +tags and case', () => {
    expect(accountIdFromAddress('ACC_01KPHFWPGDAYH9WG7KYY36KF58+web@IN.SUPPUO.COM')).toBe(
      'ACC_01KPHFWPGDAYH9WG7KYY36KF58',
    );
  });
  it('rejects foreign domains', () => {
    expect(accountIdFromAddress('acc_x@gmail.com')).toBeNull();
    expect(accountIdFromAddress('acc_x@in.suppuo.com.evil.com')).toBeNull();
  });
});

describe('isLikelyAccountId', () => {
  it('accepts the real Huudis shape (acc_ + 24 hex)', () => {
    expect(isLikelyAccountId('acc_4593c748ccb0164d7ce64baa')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isLikelyAccountId('acc_short')).toBe(false);
    expect(isLikelyAccountId('usr_4593c748ccb0164d7ce64baa')).toBe(false);
    expect(isLikelyAccountId('acc_zzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false); // non-hex
  });
});

describe('trimQuotedReply', () => {
  it('cuts at the On … wrote: marker', () => {
    const txt = 'Thanks, that fixed it!\n\nOn Tue, Jun 10, 2026 at 9:00 AM Support wrote:\n> hello';
    expect(trimQuotedReply(txt)).toBe('Thanks, that fixed it!');
  });
  it('trims trailing > quoted lines', () => {
    expect(trimQuotedReply('New info here\n> old line 1\n> old line 2')).toBe('New info here');
  });
  it('never returns empty — falls back to the original', () => {
    const allQuoted = '> only quotes\n> here';
    expect(trimQuotedReply(allQuoted)).toBe(allQuoted.trim());
  });
});

import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { API_KEY_PREFIX, generateApiKey, hashApiKey } from '../lib/api-keys.js';

describe('generateApiKey', () => {
  it('mints sk_live_<48hex> keys', () => {
    const { plaintext } = generateApiKey();
    expect(plaintext).toMatch(/^sk_live_[0-9a-f]{48}$/);
    expect(plaintext.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it('keys are unique', () => {
    expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
  });

  it('keyPrefix is a display-safe truncation of the plaintext', () => {
    const { plaintext, keyPrefix } = generateApiKey();
    expect(plaintext.startsWith(keyPrefix)).toBe(true);
    expect(keyPrefix).toMatch(/^sk_live_[0-9a-f]{4}$/);
    // Never leaks enough entropy to reconstruct the key.
    expect(keyPrefix.length).toBeLessThan(plaintext.length / 2);
  });

  it('keyHash is sha256(plaintext) hex', () => {
    const { plaintext, keyHash } = generateApiKey();
    expect(keyHash).toBe(crypto.createHash('sha256').update(plaintext).digest('hex'));
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashApiKey', () => {
  it('matches a known sha256 vector', () => {
    // sha256("sk_live_test") — fixed vector so any algorithm change trips.
    expect(hashApiKey('sk_live_test')).toBe(
      crypto.createHash('sha256').update('sk_live_test').digest('hex'),
    );
    expect(hashApiKey('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is deterministic and collision-free across different keys', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(hashApiKey(a.plaintext)).toBe(a.keyHash);
    expect(hashApiKey(a.plaintext)).not.toBe(hashApiKey(b.plaintext));
  });
});

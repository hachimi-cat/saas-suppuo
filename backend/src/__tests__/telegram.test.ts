import { describe, it, expect } from 'vitest';
import {
  generateTelegramWebhookSecret,
  telegramWebhookSecretMatches,
} from '../lib/telegram.js';

describe('generateTelegramWebhookSecret', () => {
  it('mints 48-hex secrets, uniquely', () => {
    const s = generateTelegramWebhookSecret();
    expect(s).toMatch(/^[0-9a-f]{48}$/);
    expect(generateTelegramWebhookSecret()).not.toBe(s);
  });
});

describe('telegramWebhookSecretMatches', () => {
  const secret = generateTelegramWebhookSecret();

  it('matches the exact secret', () => {
    expect(telegramWebhookSecretMatches(secret, secret)).toBe(true);
  });
  it('rejects wrong, empty, and non-string supplies', () => {
    expect(telegramWebhookSecretMatches(secret, secret.slice(0, -1) + '0')).toBe(false);
    expect(telegramWebhookSecretMatches(secret, secret + 'a')).toBe(false);
    expect(telegramWebhookSecretMatches(secret, '')).toBe(false);
    expect(telegramWebhookSecretMatches(secret, undefined)).toBe(false);
    expect(telegramWebhookSecretMatches(secret, ['x'])).toBe(false);
  });
  it('rejects when no secret is configured', () => {
    expect(telegramWebhookSecretMatches(undefined, secret)).toBe(false);
    expect(telegramWebhookSecretMatches(null, secret)).toBe(false);
    expect(telegramWebhookSecretMatches('', '')).toBe(false);
  });
});

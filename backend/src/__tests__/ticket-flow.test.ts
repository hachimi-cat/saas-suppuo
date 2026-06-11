import { describe, it, expect } from 'vitest';
import {
  nextStatusOnMessage,
  generateAccessToken,
  isTicketStatus,
  isTicketPriority,
} from '../lib/ticket-flow.js';

describe('nextStatusOnMessage', () => {
  it('requester reply re-opens everything (incl. resolved/closed)', () => {
    expect(nextStatusOnMessage('open', 'requester', false)).toBe('open');
    expect(nextStatusOnMessage('pending', 'requester', false)).toBe('open');
    expect(nextStatusOnMessage('resolved', 'requester', false)).toBe('open');
    expect(nextStatusOnMessage('closed', 'requester', false)).toBe('open');
  });

  it('agent public reply moves open → pending, leaves terminal states', () => {
    expect(nextStatusOnMessage('open', 'agent', false)).toBe('pending');
    expect(nextStatusOnMessage('pending', 'agent', false)).toBe('pending');
    expect(nextStatusOnMessage('resolved', 'agent', false)).toBe('resolved');
    expect(nextStatusOnMessage('closed', 'agent', false)).toBe('closed');
  });

  it('agent internal note never transitions', () => {
    expect(nextStatusOnMessage('open', 'agent', true)).toBe('open');
    expect(nextStatusOnMessage('resolved', 'agent', true)).toBe('resolved');
  });
});

describe('guards + token', () => {
  it('validates statuses + priorities', () => {
    expect(isTicketStatus('open')).toBe(true);
    expect(isTicketStatus('escalated')).toBe(false);
    expect(isTicketPriority('urgent')).toBe(true);
    expect(isTicketPriority('asap')).toBe(false);
  });
  it('generates unique url-safe tokens', () => {
    const a = generateAccessToken();
    const b = generateAccessToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});

import { normalizeWhatsAppFrom } from '../lib/twilio.js';

describe('normalizeWhatsAppFrom', () => {
  it('extracts E.164 from whatsapp: addresses', () => {
    expect(normalizeWhatsAppFrom('whatsapp:+6281234567890')).toBe('+6281234567890');
  });
  it('rejects non-whatsapp values', () => {
    expect(normalizeWhatsAppFrom('+6281234567890')).toBe(null);
    expect(normalizeWhatsAppFrom('whatsapp:invalid')).toBe(null);
    expect(normalizeWhatsAppFrom(42)).toBe(null);
  });
});

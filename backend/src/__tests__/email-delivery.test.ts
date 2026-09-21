import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveEmailForAccount: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../lib/channels.js', () => ({
  resolveEmailForAccount: mocks.resolveEmailForAccount,
}));
vi.mock('../lib/branding.js', () => ({
  accountHidesBranding: async () => false,
}));

const { sendAgentRepliedEmail, sendInboxNotificationEmail } = await import('../lib/email.js');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveEmailForAccount.mockResolvedValue({
    apiKey: 're_test',
    from: 'Suppuo <support@example.com>',
    byo: false,
  });
  mocks.fetch.mockResolvedValue({ ok: true, text: async () => '' });
  vi.stubGlobal('fetch', mocks.fetch);
});

describe('email delivery payloads', () => {
  it('delivers an inbox-portal reply to the requester email with a durable ticket link', async () => {
    await sendAgentRepliedEmail({
      accountId: 'acc_1',
      to: 'customer@example.com',
      ticketNumber: 7,
      subject: 'Need help',
      accessToken: 'tok_abc',
      replyBody: 'We fixed it.',
      agentName: 'Ayu',
    });

    const request = mocks.fetch.mock.calls[0]![1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload.to).toBe('customer@example.com');
    expect(payload.text).toContain('We fixed it.');
    expect(payload.text).toContain('/t/tok_abc');
    expect(payload.reply_to).toBe('acc_1@in.suppuo.com');
  });

  it('gives workspace members a direct inbox link without a requester Reply-To alias', async () => {
    await sendInboxNotificationEmail({
      accountId: 'acc_1',
      to: 'owner@example.com',
      kind: 'created',
      ticketId: 'tkt_42',
      ticketNumber: 42,
      subject: 'Order status',
      requester: 'Budi',
    });

    const request = mocks.fetch.mock.calls[0]![1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload.to).toBe('owner@example.com');
    expect(payload.text).toContain('/dashboard/tickets/tkt_42');
    expect(payload.reply_to).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import {
  isSlackWebhookUrl,
  isDiscordWebhookUrl,
  buildSlackPayload,
  buildDiscordPayload,
  notificationTitle,
  shouldNotifyTeam,
  type TeamNotification,
} from '../lib/team-notify.js';

const SLACK_URL = 'https://hooks.slack.com/services/T0001ABCD/B0002EFGH/Xx1234abcdEFGH5678ijkl';
const DISCORD_URL =
  'https://discord.com/api/webhooks/1234567890123456789/aBcDeF_gHiJkLmN-oPqRsTuVwXyZ0123456789';

describe('isSlackWebhookUrl', () => {
  it('accepts a canonical hooks.slack.com services URL', () => {
    expect(isSlackWebhookUrl(SLACK_URL)).toBe(true);
  });
  it('rejects other hosts', () => {
    expect(isSlackWebhookUrl('https://hooks.slack.com.evil.io/services/T1/B2/x')).toBe(false);
    expect(isSlackWebhookUrl('https://slack.com/services/T1/B2/xyz')).toBe(false);
    expect(isSlackWebhookUrl(DISCORD_URL)).toBe(false);
  });
  it('rejects http (non-TLS)', () => {
    expect(isSlackWebhookUrl(SLACK_URL.replace('https://', 'http://'))).toBe(false);
  });
  it('rejects wrong path shapes', () => {
    expect(isSlackWebhookUrl('https://hooks.slack.com/services/T0001ABCD')).toBe(false);
    expect(isSlackWebhookUrl('https://hooks.slack.com/api/T1/B2/xyz')).toBe(false);
  });
  it('rejects garbage', () => {
    expect(isSlackWebhookUrl('not a url')).toBe(false);
    expect(isSlackWebhookUrl('')).toBe(false);
  });
});

describe('isDiscordWebhookUrl', () => {
  it('accepts a canonical discord.com webhook URL', () => {
    expect(isDiscordWebhookUrl(DISCORD_URL)).toBe(true);
  });
  it('accepts discordapp.com and the versioned API path', () => {
    expect(
      isDiscordWebhookUrl('https://discordapp.com/api/webhooks/123456/token-abc_DEF'),
    ).toBe(true);
    expect(
      isDiscordWebhookUrl('https://discord.com/api/v10/webhooks/123456/token-abc_DEF'),
    ).toBe(true);
  });
  it('rejects other hosts', () => {
    expect(isDiscordWebhookUrl('https://discord.com.evil.io/api/webhooks/1/t')).toBe(false);
    expect(isDiscordWebhookUrl(SLACK_URL)).toBe(false);
  });
  it('rejects http (non-TLS)', () => {
    expect(isDiscordWebhookUrl(DISCORD_URL.replace('https://', 'http://'))).toBe(false);
  });
  it('rejects wrong path shapes', () => {
    expect(isDiscordWebhookUrl('https://discord.com/api/webhooks/not-an-id/token')).toBe(false);
    expect(isDiscordWebhookUrl('https://discord.com/api/webhooks/123456')).toBe(false);
  });
  it('rejects garbage', () => {
    expect(isDiscordWebhookUrl('nope')).toBe(false);
  });
});

const N: TeamNotification = {
  kind: 'created',
  number: 42,
  subject: 'Order never arrived',
  requester: 'Budi Santoso',
  ticketUrl: 'https://suppuo.forjio.com/dashboard/tickets/tkt_01htest',
};

describe('notificationTitle', () => {
  it('created → "New ticket #n: subject"', () => {
    expect(notificationTitle(N)).toBe('New ticket #42: Order never arrived');
  });
  it('replied → "Customer replied on #n: subject"', () => {
    expect(notificationTitle({ ...N, kind: 'replied' })).toBe(
      'Customer replied on #42: Order never arrived',
    );
  });
});

describe('buildSlackPayload', () => {
  it('includes number, subject, requester, and a Slack-markup link', () => {
    const p = buildSlackPayload(N);
    expect(p.text).toContain('#42');
    expect(p.text).toContain('Order never arrived');
    expect(p.text).toContain('Budi Santoso');
    expect(p.text).toContain(`<${N.ticketUrl}|`);
  });
});

describe('buildDiscordPayload', () => {
  it('produces a single embed with title/description/url', () => {
    const p = buildDiscordPayload(N);
    expect(p.embeds).toHaveLength(1);
    const embed = p.embeds[0]!;
    expect(embed.title).toBe('New ticket #42: Order never arrived');
    expect(embed.description).toContain('Budi Santoso');
    expect(embed.url).toBe(N.ticketUrl);
  });
  it('caps the embed title at 256 chars (Discord limit)', () => {
    const long = buildDiscordPayload({ ...N, subject: 'x'.repeat(400) });
    expect(long.embeds[0]!.title.length).toBeLessThanOrEqual(256);
  });
});

describe('shouldNotifyTeam', () => {
  it('always notifies on ticket.created', () => {
    expect(shouldNotifyTeam('suppuo.ticket.created.v1', { ticketId: 't' })).toBe(true);
  });
  it('notifies on requester replies only', () => {
    expect(
      shouldNotifyTeam('suppuo.ticket.replied.v1', { by: 'requester', isInternal: false }),
    ).toBe(true);
    expect(
      shouldNotifyTeam('suppuo.ticket.replied.v1', { by: 'agent', isInternal: false }),
    ).toBe(false);
    expect(
      shouldNotifyTeam('suppuo.ticket.replied.v1', { by: 'requester', isInternal: true }),
    ).toBe(false);
  });
  it('ignores other event types and malformed data', () => {
    expect(shouldNotifyTeam('suppuo.ticket.status_changed.v1', {})).toBe(false);
    expect(shouldNotifyTeam('suppuo.ticket.replied.v1', null)).toBe(false);
    expect(shouldNotifyTeam('suppuo.ticket.replied.v1', 'requester')).toBe(false);
  });
});

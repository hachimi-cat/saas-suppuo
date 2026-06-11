import { describe, it, expect, vi, afterEach } from 'vitest';
import { SuppuoClient, SuppuoError } from '../index.js';

function envelope(data: unknown) {
  return {
    data,
    error: null,
    meta: { requestId: 'req_test', timestamp: new Date().toISOString() },
  };
}

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SuppuoClient', () => {
  it('constructs with default base URL', () => {
    const c = new SuppuoClient({ token: 'test' });
    expect(c).toBeDefined();
  });

  it('lists tickets with Bearer auth and query params', async () => {
    const fetchSpy = mockFetch(200, envelope({ tickets: [], counts: {}, cursor: null, hasMore: false }));
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok_123', baseUrl: 'https://suppuo.test' });
    const out = await c.tickets.list({ status: 'open', limit: 10 });
    expect(out).toEqual({ tickets: [], counts: {}, cursor: null, hasMore: false });
    const [url, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/tickets?status=open&limit=10');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok_123' });
  });

  it('passes the full ticket filter set as query params', async () => {
    const fetchSpy = mockFetch(200, envelope({ tickets: [], counts: {}, cursor: null, hasMore: false }));
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    await c.tickets.list({
      status: 'open',
      assignee: 'me',
      tag: 'billing',
      channel: 'telegram',
      priority: 'high',
      q: 'refund',
      limit: 5,
      cursor: 'cur_abc',
    });
    const [url] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const params = new URL(String(url)).searchParams;
    expect(params.get('assignee')).toBe('me');
    expect(params.get('tag')).toBe('billing');
    expect(params.get('channel')).toBe('telegram');
    expect(params.get('priority')).toBe('high');
    expect(params.get('q')).toBe('refund');
    expect(params.get('cursor')).toBe('cur_abc');
  });

  it('fetches the distinct tag list', async () => {
    const fetchSpy = mockFetch(200, envelope({ tags: ['billing', 'bug'] }));
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.tickets.tags();
    expect(out.tags).toEqual(['billing', 'bug']);
    const [url] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/tickets/tags');
  });

  it('updates ticket tags via PATCH', async () => {
    const fetchSpy = mockFetch(200, envelope({ id: 'tkt_1', tags: ['vip'] }));
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    await c.tickets.update('tkt_1', { tags: ['vip'] });
    const [, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ tags: ['vip'] });
  });

  it('gets billing info (subscription + tiers)', async () => {
    const fetchSpy = mockFetch(
      200,
      envelope({
        subscription: { id: null, accountId: 'acc_1', tier: 'free', status: 'active' },
        earlyAccess: true,
        tiers: [{ id: 'growth', name: 'Growth', priceIdr: 299_000 }],
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.billing.get();
    expect(out.subscription.tier).toBe('free');
    expect(out.tiers[0]!.id).toBe('growth');
    const [url] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/billing');
  });

  it('creates a checkout session for a paid tier', async () => {
    const fetchSpy = mockFetch(
      200,
      envelope({ checkoutSessionId: 'cs_1', hostedUrl: 'https://pay.example/cs_1' }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.billing.checkout('growth');
    expect(out.hostedUrl).toBe('https://pay.example/cs_1');
    const [url, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/billing/checkout');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ tier: 'growth' });
  });

  it('lists channel integrations with platform flags', async () => {
    const fetchSpy = mockFetch(
      200,
      envelope({ integrations: [], platform: { whatsapp: false, email: true } }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.channels.list();
    expect(out.platform.email).toBe(true);
  });

  it('creates a telegram_bot channel integration', async () => {
    const fetchSpy = mockFetch(
      201,
      envelope({ id: 'chn_1', provider: 'telegram_bot', status: 'active' }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.channels.create({
      provider: 'telegram_bot',
      botToken: '123456789:AAexampleexampleexample',
    });
    expect(out.id).toBe('chn_1');
    const [url, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/channels');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('deletes a channel integration', async () => {
    const fetchSpy = mockFetch(200, envelope({ deleted: true }));
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.channels.delete('chn_1');
    expect(out.deleted).toBe(true);
    const [url, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/channels/chn_1');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('fetches the reports summary with a days window', async () => {
    const fetchSpy = mockFetch(200, envelope({ periodDays: 7, createdTotal: 3, openNow: 1 }));
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.reports.summary({ days: 7 });
    expect(out.periodDays).toBe(7);
    const [url] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/reports/summary?days=7');
  });

  it('reads and writes automation settings', async () => {
    const fetchSpy = mockFetch(
      200,
      envelope({
        businessHours: null,
        autoResponseEnabled: true,
        autoResponseInside: 'hi',
        autoResponseOutside: null,
        hideBranding: true,
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.settings.putAutomation({ autoResponseEnabled: true, hideBranding: true });
    expect(out.hideBranding).toBe(true);
    const [url, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/settings/automation');
    expect((init as RequestInit).method).toBe('PUT');
  });

  it('fetches CSAT stats', async () => {
    const fetchSpy = mockFetch(200, envelope({ average: 2.7, count: 12 }));
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.csat.stats();
    expect(out.average).toBe(2.7);
    const [url] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/csat/stats');
  });

  it('uploads an attachment as raw bytes with X-Filename', async () => {
    const fetchSpy = mockFetch(
      201,
      envelope({ id: 'att_1', filename: 'report.pdf', contentType: 'application/pdf', size: 3 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.attachments.upload({
      data: new Uint8Array([1, 2, 3]),
      filename: 'report.pdf',
      contentType: 'application/pdf',
    });
    expect(out.id).toBe('att_1');
    const [url, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/attachments');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['X-Filename']).toBe('report.pdf');
    expect((init as RequestInit).body).toBeInstanceOf(Uint8Array);
  });

  it('downloads an attachment with metadata from headers', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(new Uint8Array([9, 8, 7]), {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="pic.png"; filename*=UTF-8''pic.png`,
          },
        }),
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok', baseUrl: 'https://suppuo.test' });
    const out = await c.attachments.download('att_1');
    expect(out.contentType).toBe('image/png');
    expect(out.filename).toBe('pic.png');
    expect([...out.data]).toEqual([9, 8, 7]);
  });

  it('unwraps envelope errors into SuppuoError with the code', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(404, {
        data: null,
        error: { code: 'NOT_FOUND', message: 'ticket not found' },
        meta: { requestId: 'req_x', timestamp: 'now' },
      }),
    );
    const c = new SuppuoClient({ token: 'tok' });
    const err = await c.tickets.get('tkt_missing').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SuppuoError);
    expect((err as SuppuoError).code).toBe('NOT_FOUND');
    expect((err as SuppuoError).status).toBe(404);
    expect((err as SuppuoError).requestId).toBe('req_x');
  });

  it('public endpoints work without a token', async () => {
    const fetchSpy = mockFetch(201, envelope({ number: 1, accessToken: 'at_x' }));
    vi.stubGlobal('fetch', fetchSpy);
    const prev = process.env.SUPPUO_TOKEN;
    delete process.env.SUPPUO_TOKEN;
    try {
      const c = new SuppuoClient();
      const out = await c.public.submitTicket({
        accountId: 'acc_0123456789abcdef01234567',
        subject: 'Help',
        body: 'It broke',
        email: 'user@example.com',
      });
      expect(out.accessToken).toBe('at_x');
      const [, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect((init as RequestInit).headers).not.toHaveProperty('Authorization');
    } finally {
      if (prev !== undefined) process.env.SUPPUO_TOKEN = prev;
    }
  });

  it('authed endpoints without a token fail fast with AUTH_REQUIRED', async () => {
    const prev = process.env.SUPPUO_TOKEN;
    delete process.env.SUPPUO_TOKEN;
    try {
      const c = new SuppuoClient();
      const err = await c.cannedReplies.list().catch((e: unknown) => e);
      expect((err as SuppuoError).code).toBe('AUTH_REQUIRED');
    } finally {
      if (prev !== undefined) process.env.SUPPUO_TOKEN = prev;
    }
  });
});

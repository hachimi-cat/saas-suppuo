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
    const fetchSpy = mockFetch(200, envelope({ tickets: [], counts: {} }));
    vi.stubGlobal('fetch', fetchSpy);
    const c = new SuppuoClient({ token: 'tok_123', baseUrl: 'https://suppuo.test' });
    const out = await c.tickets.list({ status: 'open', limit: 10 });
    expect(out).toEqual({ tickets: [], counts: {} });
    const [url, init] = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://suppuo.test/api/v1/tickets?status=open&limit=10');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok_123' });
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

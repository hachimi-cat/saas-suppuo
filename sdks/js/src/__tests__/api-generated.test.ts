import { describe, it, expect, afterEach } from 'vitest';
import { SuppuoClient } from '../index.js';

// client.api: every feature route, generated from the API spec (scripts/apigen.sh).
describe('client.api (generated from the spec)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function capture() {
    const seen: Array<{ url: string; method: string; body?: string; auth?: string | null }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        url: typeof input === 'string' ? input : input.toString(),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : undefined,
        auth: new Headers(init?.headers).get('authorization'),
      });
      return new Response(JSON.stringify({ data: { ok: true }, error: null, meta: { requestId: 'r', timestamp: '' } }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    return seen;
  }

  it('creates a ticket with the fields Suppuo validates, with the Bearer key', async () => {
    const seen = capture();
    const client = new SuppuoClient({ token: 'sk_live_test', baseUrl: 'https://suppuo.test' });
    const out = await client.api.ticketsCreate({ subject: 'Refund', body: 'Order 42', requesterEmail: 'a@b.co', channel: 'email' });
    expect(out).toEqual({ ok: true });
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('https://suppuo.test/api/v1/tickets');
    expect(JSON.parse(seen[0]!.body!)).toEqual({ subject: 'Refund', body: 'Order 42', requesterEmail: 'a@b.co', channel: 'email' });
    expect(seen[0]!.auth).toBe('Bearer sk_live_test');
  });

  it('puts path parameters in the path and query fields in the query', async () => {
    const seen = capture();
    const client = new SuppuoClient({ token: 'sk_live_test', baseUrl: 'https://suppuo.test' });
    await client.api.ticketsGet('tkt 1');
    await client.api.ticketsList({ status: 'open', limit: 5 });
    expect(seen[0]!.url).toBe('https://suppuo.test/api/v1/tickets/tkt%201');
    const listed = new URL(seen[1]!.url);
    expect(listed.pathname).toBe('/api/v1/tickets');
    expect(Object.fromEntries(listed.searchParams)).toEqual({ status: 'open', limit: '5' });
  });

  it('calls the requester-facing public routes without a token, like client.public', async () => {
    const seen = capture();
    const client = new SuppuoClient({ token: '', baseUrl: 'https://suppuo.test' });
    await client.api.publicTicketsCsat('tok_abc', { score: 3 });
    expect(seen[0]!.url).toBe('https://suppuo.test/api/v1/public/tickets/tok_abc/csat');
    expect(seen[0]!.auth).toBeNull();
  });

  it('has a method for every feature route', () => {
    const client = new SuppuoClient({ token: 't' });
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client.api)).filter(
      (n) => n !== 'constructor' && n !== 'call',
    );
    expect(methods.length).toBeGreaterThanOrEqual(70);
  });
});

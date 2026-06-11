/**
 * Suppuo SDK — typed JS/TS client for the suppuo.com REST API.
 * Sister to `forjio-suppuo` (Python) and `hachimi-cat/suppuo-go` (Go).
 *
 * Auth = Bearer JWT (a Huudis-minted access token). Pass `token` or set
 * `SUPPUO_TOKEN`. The `public.*` surface (requester-facing hosted-form
 * endpoints) needs no token at all.
 *
 * Every response rides the Forjio envelope `{ data, error, meta }`;
 * the client unwraps it and throws `SuppuoError` (with the envelope's
 * `error.code`) on failure.
 */

// ─── Envelope + error ─────────────────────────────────────────────────

export interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string; param?: string; docUrl?: string } | null;
  meta?: {
    requestId: string;
    timestamp: string;
    cursor?: string | null;
    hasMore?: boolean;
  };
}

export class SuppuoError extends Error {
  /** HTTP status (0 for transport-level failures). */
  readonly status: number;
  /** Envelope `error.code` (UPPER_SNAKE_CASE) or an SDK-side code
   *  (`NETWORK_ERROR`, `TIMEOUT`, `INVALID_RESPONSE`). */
  readonly code: string;
  readonly requestId: string | undefined;
  readonly param: string | undefined;

  constructor(status: number, code: string, message: string, requestId?: string, param?: string) {
    super(message);
    this.name = 'SuppuoError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.param = param;
  }
}

// ─── Domain types ─────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketChannel = 'web' | 'email' | 'whatsapp';

export interface Ticket {
  id: string;
  accountId: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  requesterEmail: string | null;
  requesterName: string | null;
  requesterPhone?: string | null;
  assigneeSub: string | null;
  accessToken: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorType: 'agent' | 'requester';
  authorSub?: string | null;
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
}

export interface TicketList {
  tickets: Ticket[];
  /** Per-status counts for the whole workspace, e.g. `{ open: 3, pending: 1 }`. */
  counts: Partial<Record<TicketStatus, number>>;
}

export interface CannedReply {
  id: string;
  accountId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTicketView {
  number: number;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  messages: Array<{
    id: string;
    authorType: 'agent' | 'requester';
    authorName: string | null;
    body: string;
    createdAt: string;
  }>;
}

// ─── Client ───────────────────────────────────────────────────────────

export interface SuppuoClientOptions {
  /** Bearer access token (Huudis-minted JWT). Defaults to `SUPPUO_TOKEN`.
   *  Optional — the `public.*` surface works without one. */
  token?: string;
  /** Base URL override. Default `https://suppuo.com`. */
  baseUrl?: string;
  /** Per-request fetch timeout. Default 30s. */
  timeoutMs?: number;
}

interface FetchArgs {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Public endpoints skip the Authorization header entirely. */
  noAuth?: boolean;
}

export class SuppuoClient {
  private readonly token: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: SuppuoClientOptions = {}) {
    this.token = opts.token ?? process.env.SUPPUO_TOKEN ?? undefined;
    this.baseUrl = (opts.baseUrl ?? 'https://suppuo.com').replace(/\/+$/, '');
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async request<T>(args: FetchArgs): Promise<T> {
    const url = new URL(this.baseUrl + args.path);
    for (const [k, v] of Object.entries(args.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!args.noAuth) {
      if (!this.token) {
        throw new SuppuoError(
          0,
          'AUTH_REQUIRED',
          'No token configured. Pass `token` or set SUPPUO_TOKEN.',
        );
      }
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (args.body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(url, {
        method: args.method,
        headers,
        body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'TimeoutError') {
        throw new SuppuoError(0, 'TIMEOUT', `request timed out after ${this.timeoutMs}ms`);
      }
      throw new SuppuoError(0, 'NETWORK_ERROR', e instanceof Error ? e.message : String(e));
    }

    let envelope: ApiEnvelope<T>;
    try {
      envelope = (await res.json()) as ApiEnvelope<T>;
    } catch {
      throw new SuppuoError(res.status, 'INVALID_RESPONSE', `non-JSON response (HTTP ${res.status})`);
    }

    if (!res.ok || envelope.error) {
      const err = envelope.error;
      throw new SuppuoError(
        res.status,
        err?.code ?? 'UNKNOWN',
        err?.message ?? `HTTP ${res.status}`,
        envelope.meta?.requestId,
        err?.param,
      );
    }
    return envelope.data as T;
  }

  // ─── Tickets (agent workspace surface, Bearer auth) ───────────────

  readonly tickets = {
    /** GET /api/v1/tickets — newest-activity-first, with per-status counts. */
    list: (params?: { status?: TicketStatus | 'all'; limit?: number }): Promise<TicketList> =>
      this.request({
        method: 'GET',
        path: '/api/v1/tickets',
        query: { status: params?.status, limit: params?.limit },
      }),

    /** GET /api/v1/tickets/:id — full ticket incl. message thread. */
    get: (id: string): Promise<TicketWithMessages> =>
      this.request({ method: 'GET', path: `/api/v1/tickets/${encodeURIComponent(id)}` }),

    /** POST /api/v1/tickets — agent-logged ticket (e.g. arrived via WhatsApp). */
    create: (input: {
      subject: string;
      body: string;
      requesterEmail: string;
      requesterName?: string;
      priority?: TicketPriority;
      channel?: TicketChannel;
    }): Promise<Ticket> => this.request({ method: 'POST', path: '/api/v1/tickets', body: input }),

    /** POST /api/v1/tickets/:id/messages — agent reply (or internal note). */
    reply: (
      id: string,
      input: { body: string; isInternal?: boolean; authorName?: string },
    ): Promise<{ message: TicketMessage; status: TicketStatus }> =>
      this.request({
        method: 'POST',
        path: `/api/v1/tickets/${encodeURIComponent(id)}/messages`,
        body: input,
      }),

    /** PATCH /api/v1/tickets/:id — status / priority / assignee. */
    update: (
      id: string,
      patch: { status?: TicketStatus; priority?: TicketPriority; assigneeSub?: string | null },
    ): Promise<Ticket> =>
      this.request({
        method: 'PATCH',
        path: `/api/v1/tickets/${encodeURIComponent(id)}`,
        body: patch,
      }),
  };

  // ─── Canned replies ────────────────────────────────────────────────

  readonly cannedReplies = {
    /** GET /api/v1/canned-replies */
    list: (): Promise<{ cannedReplies: CannedReply[] }> =>
      this.request({ method: 'GET', path: '/api/v1/canned-replies' }),

    /** POST /api/v1/canned-replies */
    create: (input: { title: string; body: string }): Promise<CannedReply> =>
      this.request({ method: 'POST', path: '/api/v1/canned-replies', body: input }),

    /** PATCH /api/v1/canned-replies/:id */
    update: (id: string, patch: { title?: string; body?: string }): Promise<CannedReply> =>
      this.request({
        method: 'PATCH',
        path: `/api/v1/canned-replies/${encodeURIComponent(id)}`,
        body: patch,
      }),

    /** DELETE /api/v1/canned-replies/:id */
    delete: (id: string): Promise<{ deleted: boolean }> =>
      this.request({ method: 'DELETE', path: `/api/v1/canned-replies/${encodeURIComponent(id)}` }),
  };

  // ─── Public (requester-facing, unauthenticated) ────────────────────

  readonly public = {
    /** POST /api/v1/public/tickets — submit to a workspace's hosted form.
     *  The returned `accessToken` is the requester's only credential. */
    submitTicket: (input: {
      accountId: string;
      subject: string;
      body: string;
      email: string;
      name?: string;
    }): Promise<{ number: number; accessToken: string }> =>
      this.request({ method: 'POST', path: '/api/v1/public/tickets', body: input, noAuth: true }),

    /** GET /api/v1/public/tickets/:accessToken — tokenized status view
     *  (public messages only; internal notes are never exposed). */
    getTicket: (accessToken: string): Promise<PublicTicketView> =>
      this.request({
        method: 'GET',
        path: `/api/v1/public/tickets/${encodeURIComponent(accessToken)}`,
        noAuth: true,
      }),

    /** POST /api/v1/public/tickets/:accessToken/messages — requester reply. */
    replyTicket: (
      accessToken: string,
      input: { body: string },
    ): Promise<{ id: string; status: TicketStatus }> =>
      this.request({
        method: 'POST',
        path: `/api/v1/public/tickets/${encodeURIComponent(accessToken)}/messages`,
        body: input,
        noAuth: true,
      }),
  };
}

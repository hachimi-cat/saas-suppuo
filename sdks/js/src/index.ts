/**
 * Suppuo SDK — typed JS/TS client for the suppuo.com REST API.
 * Sister to `forjio-suppuo` (Python) and `hachimi-cat/suppuo-go` (Go).
 *
 * Auth = Bearer token — an `sk_live_…` API key from the dashboard (or a
 * Huudis-minted access token). Pass `token` or set `SUPPUO_TOKEN`. The
 * `public.*` surface (requester-facing hosted-form endpoints) needs no
 * token at all.
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
export type TicketChannel = 'web' | 'email' | 'whatsapp' | 'telegram';

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
  /** E.164 phone for WhatsApp-channel tickets (e.g. +62812…). */
  requesterPhone?: string | null;
  /** Channel-native requester identity for non-phone channels —
   *  the Telegram chat id for channel=telegram tickets. */
  requesterExternalId?: string | null;
  /** Huudis sub of the assigned agent (workspace member), if any. */
  assigneeSub: string | null;
  /** Free-form labels (normalized: trimmed, lowercased, deduped;
   *  max 10 tags × 40 chars). */
  tags: string[];
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
  /** Display-safe attachment metadata (present on `tickets.get`). */
  attachments?: AttachmentMeta[];
}

export interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
}

export interface TicketListParams {
  status?: TicketStatus | 'all';
  /** Huudis sub, or 'me' (the caller), or 'unassigned'. */
  assignee?: string;
  /** Exact tag match (tags are normalized lowercase). */
  tag?: string;
  channel?: TicketChannel;
  priority?: TicketPriority;
  /** Free-text search: subject + requester email/name + message bodies. */
  q?: string;
  /** Page size 1-100 (default 50). */
  limit?: number;
  /** Opaque cursor from a previous page. */
  cursor?: string;
}

export interface TicketList {
  tickets: Ticket[];
  /** Per-status counts for the whole workspace, e.g. `{ open: 3, pending: 1 }`. */
  counts: Partial<Record<TicketStatus, number>>;
  /** Opaque cursor for the next page (null when this is the last page). */
  cursor: string | null;
  hasMore: boolean;
}

export interface CannedReply {
  id: string;
  accountId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Billing ──────────────────────────────────────────────────────────

export type BillingTier = 'free' | 'starter' | 'growth' | 'business';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled';

export interface TierDef {
  id: BillingTier;
  name: string;
  /** Whole rupiah per month. 0 = free. */
  priceIdr: number;
  blurb: string;
  features: string[];
  /** Agent-seat limit (Huudis workspace members). */
  agentLimit: number;
  /** Connected WhatsApp numbers (BYO integrations) allowed. */
  waNumberLimit: number;
}

export interface BillingSubscription {
  id: string | null;
  accountId: string;
  tier: BillingTier;
  status: SubscriptionStatus;
  plugipayCheckoutSessionId: string | null;
  currentPeriodEnd: string | null;
}

export interface BillingInfo {
  subscription: BillingSubscription;
  /** Early access: paid tiers are recorded truthfully but no limits
   *  are enforced yet. */
  earlyAccess: boolean;
  tiers: TierDef[];
}

export interface CheckoutResult {
  checkoutSessionId: string;
  /** Plugipay hosted checkout — redirect the browser here. */
  hostedUrl: string;
}

// ─── Channels ─────────────────────────────────────────────────────────

export type ChannelProvider =
  | 'whatsapp_twilio'
  | 'whatsapp_cloud'
  | 'email_resend'
  | 'telegram_bot'
  | 'slack_webhook'
  | 'discord_webhook';

export interface ChannelIntegration {
  id: string;
  provider: ChannelProvider;
  externalId: string | null;
  displayName: string;
  status: string;
  config: unknown;
  lastError: string | null;
  createdAt: string;
}

export interface ChannelList {
  integrations: ChannelIntegration[];
  /** Whether the Suppuo platform itself has shared WhatsApp/email
   *  credentials configured (BYO integrations work regardless). */
  platform: { whatsapp: boolean; email: boolean };
}

/** Created integrations may carry setup hints (webhook URL to register,
 *  Meta verify token, human-readable next step). */
export interface ChannelCreated extends ChannelIntegration {
  webhookUrl?: string;
  verifyToken?: string;
  note?: string;
}

export type ChannelCreateInput =
  | {
      provider: 'whatsapp_twilio';
      /** Twilio Account SID (AC…). */
      accountSid: string;
      authToken: string;
      /** E.164, e.g. +62812…. */
      whatsappNumber: string;
      displayName?: string;
    }
  | {
      provider: 'whatsapp_cloud';
      /** Meta Cloud API access token. */
      accessToken: string;
      phoneNumberId: string;
      wabaId?: string;
      /** The number's human-facing E.164 (+62…). */
      displayNumber: string;
      /** Webhook handshake token — generated when absent. */
      verifyToken?: string;
      /** Meta app secret — enables webhook signature verification. */
      appSecret?: string;
      displayName?: string;
    }
  | {
      provider: 'email_resend';
      apiKey: string;
      fromEmail: string;
      fromName?: string;
    }
  | {
      provider: 'telegram_bot';
      /** Bot token from @BotFather (123456789:AA…). */
      botToken: string;
      displayName?: string;
    }
  | { provider: 'slack_webhook'; webhookUrl: string; displayName?: string }
  | { provider: 'discord_webhook'; webhookUrl: string; displayName?: string };

// ─── Reports / settings / CSAT / attachments ──────────────────────────

export interface ReportsSummary {
  periodDays: number;
  createdPerDay: Array<{ day: string; count: number }>;
  createdTotal: number;
  byChannel: Array<{ channel: string; count: number }>;
  /** CURRENT snapshot across all tickets (not period-scoped). */
  byStatus: Array<{ status: string; count: number }>;
  openNow: number;
  resolvedInPeriod: number;
  firstResponse: { medianSeconds: number | null; p90Seconds: number | null; count: number };
  resolution: { medianSeconds: number | null; p90Seconds: number | null; count: number };
  csat: { average: number | null; count: number; distribution: Record<string, number> };
}

export interface BusinessHours {
  /** IANA timezone, e.g. "Asia/Jakarta". */
  tz: string;
  /** 7 entries (dow 0-6); null = closed that day. */
  days: Array<{ dow: number; open: string; close: string } | null>;
}

export interface AutomationSettings {
  businessHours: BusinessHours | null;
  autoResponseEnabled: boolean;
  autoResponseInside: string | null;
  autoResponseOutside: string | null;
  /** Hide "Powered by Suppuo" in requester-facing surfaces. */
  hideBranding: boolean;
}

export interface AutomationSettingsPatch {
  businessHours?: BusinessHours | null;
  autoResponseEnabled?: boolean;
  autoResponseInside?: string | null;
  autoResponseOutside?: string | null;
  hideBranding?: boolean;
}

export interface CsatStats {
  /** Average score 1..3 (null with no responses yet). */
  average: number | null;
  count: number;
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
}

export interface AttachmentDownload {
  data: Uint8Array;
  contentType: string;
  filename: string;
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
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Public endpoints skip the Authorization header entirely. */
  noAuth?: boolean;
  /** Raw (non-JSON) request body — used by attachment uploads. Set
   *  `headers` for Content-Type / X-Filename; `body` is ignored. */
  rawBody?: Uint8Array;
  /** Extra request headers (raw uploads). */
  headers?: Record<string, string>;
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

    const headers: Record<string, string> = { Accept: 'application/json', ...args.headers };
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
    if (args.rawBody === undefined && args.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: args.method,
        headers,
        body:
          args.rawBody !== undefined
            ? (args.rawBody as BodyInit)
            : args.body !== undefined
              ? JSON.stringify(args.body)
              : undefined,
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
    /** GET /api/v1/tickets — newest-activity-first, filterable, with
     *  per-status counts + a keyset cursor. */
    list: (params?: TicketListParams): Promise<TicketList> =>
      this.request({
        method: 'GET',
        path: '/api/v1/tickets',
        query: {
          status: params?.status,
          assignee: params?.assignee,
          tag: params?.tag,
          channel: params?.channel,
          priority: params?.priority,
          q: params?.q,
          limit: params?.limit,
          cursor: params?.cursor,
        },
      }),

    /** GET /api/v1/tickets/tags — distinct tags across the workspace
     *  (autocomplete feed). */
    tags: (): Promise<{ tags: string[] }> =>
      this.request({ method: 'GET', path: '/api/v1/tickets/tags' }),

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
      /** 'web' | 'email' | 'whatsapp' — telegram tickets only arrive
       *  via the bot webhook. */
      channel?: Exclude<TicketChannel, 'telegram'>;
    }): Promise<Ticket> => this.request({ method: 'POST', path: '/api/v1/tickets', body: input }),

    /** POST /api/v1/tickets/:id/messages — agent reply (or internal note).
     *  Stage files first via `attachments.upload` and pass their ids. */
    reply: (
      id: string,
      input: { body: string; isInternal?: boolean; authorName?: string; attachmentIds?: string[] },
    ): Promise<{ message: TicketMessage; status: TicketStatus }> =>
      this.request({
        method: 'POST',
        path: `/api/v1/tickets/${encodeURIComponent(id)}/messages`,
        body: input,
      }),

    /** PATCH /api/v1/tickets/:id — status / priority / assignee / tags. */
    update: (
      id: string,
      patch: {
        status?: TicketStatus;
        priority?: TicketPriority;
        assigneeSub?: string | null;
        /** Replaces the full tag list (normalized server-side). */
        tags?: string[];
      },
    ): Promise<Ticket> =>
      this.request({
        method: 'PATCH',
        path: `/api/v1/tickets/${encodeURIComponent(id)}`,
        body: patch,
      }),
  };

  // ─── Billing ───────────────────────────────────────────────────────

  readonly billing = {
    /** GET /api/v1/billing — current subscription + the tier table. */
    get: (): Promise<BillingInfo> => this.request({ method: 'GET', path: '/api/v1/billing' }),

    /** POST /api/v1/billing/checkout — Plugipay hosted checkout for a
     *  paid tier ('starter' | 'growth' | 'business'); redirect the
     *  browser to `hostedUrl`. */
    checkout: (tier: Exclude<BillingTier, 'free'>): Promise<CheckoutResult> =>
      this.request({ method: 'POST', path: '/api/v1/billing/checkout', body: { tier } }),
  };

  // ─── Channels (BYO integrations) ───────────────────────────────────

  readonly channels = {
    /** GET /api/v1/channels — integrations (credentials never included)
     *  + platform capability flags. */
    list: (): Promise<ChannelList> => this.request({ method: 'GET', path: '/api/v1/channels' }),

    /** POST /api/v1/channels — connect a provider. Credentials are
     *  validated live against the provider before the integration
     *  activates. */
    create: (input: ChannelCreateInput): Promise<ChannelCreated> =>
      this.request({ method: 'POST', path: '/api/v1/channels', body: input }),

    /** DELETE /api/v1/channels/:id */
    delete: (id: string): Promise<{ deleted: boolean }> =>
      this.request({ method: 'DELETE', path: `/api/v1/channels/${encodeURIComponent(id)}` }),
  };

  // ─── Reports ───────────────────────────────────────────────────────

  readonly reports = {
    /** GET /api/v1/reports/summary?days= — support analytics for the
     *  window (7 | 30 | 90 days; default 30). */
    summary: (params?: { days?: 7 | 30 | 90 }): Promise<ReportsSummary> =>
      this.request({
        method: 'GET',
        path: '/api/v1/reports/summary',
        query: { days: params?.days },
      }),
  };

  // ─── Settings ──────────────────────────────────────────────────────

  readonly settings = {
    /** GET /api/v1/settings/automation — business hours + auto-response
     *  + branding. */
    getAutomation: (): Promise<AutomationSettings> =>
      this.request({ method: 'GET', path: '/api/v1/settings/automation' }),

    /** PUT /api/v1/settings/automation — partial update; omitted fields
     *  are left alone, explicit null clears. */
    putAutomation: (patch: AutomationSettingsPatch): Promise<AutomationSettings> =>
      this.request({ method: 'PUT', path: '/api/v1/settings/automation', body: patch }),
  };

  // ─── CSAT ──────────────────────────────────────────────────────────

  readonly csat = {
    /** GET /api/v1/csat/stats — workspace-lifetime average + count. */
    stats: (): Promise<CsatStats> => this.request({ method: 'GET', path: '/api/v1/csat/stats' }),
  };

  // ─── Attachments ───────────────────────────────────────────────────

  readonly attachments = {
    /** POST /api/v1/attachments — stage an upload (raw bytes + filename;
     *  8MB max). Bind the returned id to a reply via
     *  `tickets.reply(..., { attachmentIds })`. */
    upload: (input: {
      data: Uint8Array; // Buffer works too (it IS a Uint8Array)
      filename: string;
      contentType: string;
    }): Promise<AttachmentMeta> =>
      this.request({
        method: 'POST',
        path: '/api/v1/attachments',
        rawBody: input.data,
        headers: {
          'Content-Type': input.contentType,
          'X-Filename': encodeURIComponent(input.filename),
        },
      }),

    /** GET /api/v1/attachments/:id — download the bytes (account-scoped). */
    download: async (id: string): Promise<AttachmentDownload> => {
      if (!this.token) {
        throw new SuppuoError(
          0,
          'AUTH_REQUIRED',
          'No token configured. Pass `token` or set SUPPUO_TOKEN.',
        );
      }
      const url = `${this.baseUrl}/api/v1/attachments/${encodeURIComponent(id)}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.token}` },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (e) {
        if (e instanceof Error && e.name === 'TimeoutError') {
          throw new SuppuoError(0, 'TIMEOUT', `request timed out after ${this.timeoutMs}ms`);
        }
        throw new SuppuoError(0, 'NETWORK_ERROR', e instanceof Error ? e.message : String(e));
      }
      if (!res.ok) {
        // Error responses ride the JSON envelope even on this binary route.
        let envelope: ApiEnvelope<never> | null = null;
        try {
          envelope = (await res.json()) as ApiEnvelope<never>;
        } catch {
          /* fall through to generic */
        }
        throw new SuppuoError(
          res.status,
          envelope?.error?.code ?? 'UNKNOWN',
          envelope?.error?.message ?? `HTTP ${res.status}`,
          envelope?.meta?.requestId,
          envelope?.error?.param,
        );
      }
      const data = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
      const disposition = res.headers.get('content-disposition') ?? '';
      const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
      const plain = /filename="([^"]*)"/i.exec(disposition);
      const filename = star ? decodeURIComponent(star[1]!) : (plain?.[1] ?? id);
      return { data, contentType, filename };
    },
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

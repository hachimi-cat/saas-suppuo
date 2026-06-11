import crypto from 'node:crypto';

// WhatsApp Cloud API (Meta direct) — BYO channel. The workspace brings
// its own Meta app + WABA: a permanent access token + a phone number
// ID. Inbound arrives on /api/v1/webhooks/whatsapp-cloud (Graph webhook
// subscription); outbound goes straight to graph.facebook.com. No
// Twilio in between.

export const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export interface CloudChannelCreds {
  accessToken: string;
  /** Meta APP secret — optional. When present we verify
   *  X-Hub-Signature-256 on inbound webhooks; when absent the verify
   *  token (handshake) + phone-number-ID routing are the only gates. */
  appSecret?: string;
}

/** One inbound text message extracted from a Meta webhook delivery. */
export interface CloudInboundMessage {
  /** value.metadata.phone_number_id — routes to the integration. */
  phoneNumberId: string;
  /** Sender in E.164 WITH the + prefix (Meta omits it). */
  from: string;
  /** WhatsApp profile name, when Meta included a contacts[] entry. */
  profileName: string | null;
  /** Message text body (text messages only). */
  body: string;
  /** Meta message id (wamid.…) — useful for logging/dedup. */
  messageId: string | null;
}

/** Parse a Meta WhatsApp webhook POST body into inbound text messages.
 *  Tolerant of anything-shaped input (Meta retries aggressively, so the
 *  webhook must never throw on a weird payload): non-message changes
 *  (statuses / read receipts) and non-text message types are skipped. */
export function parseCloudInboundMessages(payload: unknown): CloudInboundMessage[] {
  const out: CloudInboundMessage[] = [];
  if (!payload || typeof payload !== 'object') return out;
  const root = payload as { object?: unknown; entry?: unknown };
  if (!Array.isArray(root.entry)) return out;

  for (const entry of root.entry) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: unknown })?.value;
      if (!value || typeof value !== 'object') continue;
      const v = value as {
        metadata?: { phone_number_id?: unknown };
        contacts?: Array<{ wa_id?: unknown; profile?: { name?: unknown } }>;
        messages?: Array<{
          id?: unknown;
          from?: unknown;
          type?: unknown;
          text?: { body?: unknown };
        }>;
      };
      const phoneNumberId =
        typeof v.metadata?.phone_number_id === 'string' ? v.metadata.phone_number_id : null;
      if (!phoneNumberId || !Array.isArray(v.messages)) continue; // statuses-only delivery

      // Profile names arrive in a parallel contacts[] array keyed on wa_id.
      const names = new Map<string, string>();
      if (Array.isArray(v.contacts)) {
        for (const c of v.contacts) {
          const waId = typeof c?.wa_id === 'string' ? c.wa_id : null;
          const name = typeof c?.profile?.name === 'string' ? c.profile.name.trim() : '';
          if (waId && name) names.set(waId, name);
        }
      }

      for (const m of v.messages) {
        if (m?.type !== 'text') continue; // v1: text only
        const from = typeof m.from === 'string' ? m.from : null;
        const body = typeof m.text?.body === 'string' ? m.text.body.trim() : '';
        if (!from || !/^\d{6,16}$/.test(from) || !body) continue;
        out.push({
          phoneNumberId,
          from: `+${from}`, // Meta sends bare digits; tickets store E.164
          profileName: names.get(from) ?? null,
          body,
          messageId: typeof m.id === 'string' ? m.id : null,
        });
      }
    }
  }
  return out;
}

/** Verify Meta's X-Hub-Signature-256 header: `sha256=` +
 *  hex(HMAC-SHA256(appSecret, rawBody)). */
export function verifyMetaSignature(
  rawBody: string,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const supplied = header.slice('sha256='.length);
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Random verify token for the Meta webhook handshake (generated when
 *  the connect payload doesn't supply one). */
export function generateVerifyToken(): string {
  return `suppuo_verify_${crypto.randomBytes(16).toString('hex')}`;
}

/** Send a WhatsApp text via the Cloud API (one POST to Graph). */
export async function sendWhatsAppCloud(opts: {
  accessToken: string;
  phoneNumberId: string;
  /** Recipient in E.164 (with or without the + — Graph accepts both). */
  to: string;
  body: string;
}): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${opts.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: opts.to.replace(/^\+/, ''),
      type: 'text',
      text: { body: opts.body },
    }),
  });
  if (!res.ok) {
    throw new Error(`whatsapp cloud send ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

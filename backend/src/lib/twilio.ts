import crypto from 'node:crypto';

// Twilio WhatsApp integration — env-gated, fire-and-forget at the call
// sites (a WhatsApp send failure must never fail a ticket write).
//
// Env:
//   TWILIO_ACCOUNT_SID        AC…
//   TWILIO_AUTH_TOKEN         account auth token (REST auth + the
//                             X-Twilio-Signature webhook validation)
//   TWILIO_WHATSAPP_FROM      whatsapp:+62… (the workspace's WA number)
//   SUPPUO_TWILIO_ACCOUNT_ID  which Suppuo workspace owns inbound WA
//                             tickets (single-number v1; per-workspace
//                             number routing is the multi-tenant step)
//   SUPPUO_TWILIO_WEBHOOK_SECRET  shared secret in the webhook URL

export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM,
  );
}

export function whatsappInboundAccountId(): string | null {
  return process.env.SUPPUO_TWILIO_ACCOUNT_ID ?? null;
}

export function webhookSecretMatches(supplied: string | undefined): boolean {
  const expected = process.env.SUPPUO_TWILIO_WEBHOOK_SECRET;
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** "whatsapp:+62812..." → "+62812..." (E.164). Returns null when the
 *  value isn't a WhatsApp address. */
export function normalizeWhatsAppFrom(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^whatsapp:(\+\d{6,16})$/);
  return m ? (m[1] ?? null) : null;
}

/** Send a WhatsApp message via the Twilio REST API (no SDK — one POST). */
export async function sendWhatsApp(opts: { to: string; body: string }): Promise<void> {
  const account = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!account || !token || !from) {
    console.log(`[twilio:dev] would send WhatsApp to ${opts.to}: ${opts.body.slice(0, 80)}`);
    return;
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${account}:${token}`).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:${opts.to}`,
        Body: opts.body,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`twilio send ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** Classic Twilio webhook validation: base64(HMAC-SHA1(authToken,
 *  url + sorted(key+value))) compared to X-Twilio-Signature. Used IN
 *  ADDITION to the URL secret (defense in depth). Soft-passes when the
 *  auth token isn't configured. */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | undefined,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true; // not configured — URL secret is the gate
  if (!signature) return false;
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('');
  const expected = crypto.createHmac('sha1', token).update(data).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

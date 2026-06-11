import crypto from 'node:crypto';

// Telegram Bot API integration — BYO bot per workspace (the token comes
// from @BotFather). One bot = one integration; inbound updates arrive
// on a per-integration webhook (/api/v1/webhooks/telegram/:id?secret=…)
// registered automatically via setWebhook at connect time. Outbound
// agent replies are a single sendMessage POST — fire-and-forget at the
// call site (a Telegram send failure must never fail a ticket write).

const API_TIMEOUT_MS = 10_000;

export interface TelegramBotInfo {
  id: number;
  username: string | null;
  firstName: string | null;
}

/** Live token validation: who is this bot? Returns null when Telegram
 *  rejects the token (or is unreachable). */
export async function telegramGetMe(botToken: string): Promise<TelegramBotInfo | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ok?: boolean;
      result?: { id?: number; username?: string; first_name?: string };
    };
    if (!body.ok || typeof body.result?.id !== 'number') return null;
    return {
      id: body.result.id,
      username: body.result.username ?? null,
      firstName: body.result.first_name ?? null,
    };
  } catch {
    return null;
  }
}

/** Point the bot's webhook at our per-integration inbound URL. */
export async function telegramSetWebhook(botToken: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, allowed_updates: ['message'] }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

/** Agent reply → the requester's Telegram chat. */
export async function sendTelegramMessage(opts: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${opts.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: opts.chatId, text: opts.text }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`telegram sendMessage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** Per-integration inbound webhook secret (lives in the integration's
 *  config; carried in the ?secret= query of the webhook URL). */
export function generateTelegramWebhookSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}

/** Timing-safe compare of the supplied ?secret= against the stored
 *  per-integration secret. */
export function telegramWebhookSecretMatches(
  expected: string | undefined | null,
  supplied: unknown,
): boolean {
  if (!expected || typeof supplied !== 'string' || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

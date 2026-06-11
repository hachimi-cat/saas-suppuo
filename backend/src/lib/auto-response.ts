import { prisma } from './db.js';
import { newId } from './ids.js';
import { sendAgentRepliedEmail } from './email.js';
import { sendWhatsApp } from './twilio.js';
import { sendWhatsAppCloud } from './whatsapp-cloud.js';
import { sendTelegramMessage } from './telegram.js';
import { resolveWhatsAppForAccount, resolveTelegramForAccount } from './channels.js';

/*
 * Feature wave: CSAT + automation — the auto-response consumer.
 *
 * Called from the outbox worker on `suppuo.ticket.created.v1`: when the
 * workspace has auto-response enabled, send the business-hours-aware
 * auto-ack back over the ticket's ORIGIN channel (email / WhatsApp /
 * Telegram — mirroring the agent-reply fan-out in routes/tickets.ts)
 * and record it as a real TicketMessage (authorType 'agent',
 * authorName 'Auto-reply') so it shows up in both the agent and the
 * requester thread views.
 *
 * Idempotency: the standard consumer guard — an atomic INSERT into
 * processed_events keyed on `auto_response:<eventId>`; replays hit the
 * PK unique and exit cleanly (ADR-0006).
 *
 * Everything here is fire-and-forget from the worker's perspective: an
 * auto-ack failure must never block outbox publishing.
 */

export const AUTO_REPLY_AUTHOR = 'Auto-reply';

// ── Business-hours evaluation (pure, unit-tested) ────────────────────

export interface BusinessHoursDay {
  /** Day of week, 0 = Sunday … 6 = Saturday (local to `tz`). */
  dow: number;
  /** "HH:mm", 24h. */
  open: string;
  /** "HH:mm", 24h. open > close ⇒ the window spans midnight. */
  close: string;
}

export interface BusinessHours {
  /** IANA zone, e.g. 'Asia/Jakarta' (WIB). */
  tz: string;
  /** Indexed by dow (0 = Sunday); null = closed that day. */
  days: Array<BusinessHoursDay | null>;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "09:30" → 570 (minutes since local midnight); null when malformed. */
export function parseHHMM(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = HHMM.exec(v);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Loose runtime validation of the stored JSON shape. */
export function parseBusinessHours(raw: unknown): BusinessHours | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { tz?: unknown; days?: unknown };
  if (typeof o.tz !== 'string' || !Array.isArray(o.days)) return null;
  const days: Array<BusinessHoursDay | null> = [];
  for (const d of o.days) {
    if (d === null || d === undefined) {
      days.push(null);
      continue;
    }
    const e = d as { dow?: unknown; open?: unknown; close?: unknown };
    if (
      typeof e.dow !== 'number' ||
      e.dow < 0 ||
      e.dow > 6 ||
      parseHHMM(e.open) === null ||
      parseHHMM(e.close) === null
    ) {
      return null;
    }
    days.push({ dow: e.dow, open: e.open as string, close: e.close as string });
  }
  return { tz: o.tz, days };
}

/** Wall-clock parts of `at` in `tz` (falls back to Asia/Jakarta when
 *  the zone is unknown). */
export function localParts(at: Date, tz: string): { dow: number; minutes: number } {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  }
  const parts = fmt.formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    dow: dowMap[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function entryFor(bh: BusinessHours, dow: number): BusinessHoursDay | null {
  // Primary layout: days indexed by dow. Tolerate sparse arrays that
  // carry the dow inline instead.
  const byIndex = bh.days[dow];
  if (byIndex && byIndex.dow === dow) return byIndex;
  return bh.days.find((d) => d?.dow === dow) ?? null;
}

/**
 * Is `at` inside the workspace's business hours?
 *
 *  - No / malformed config ⇒ always inside (an unconfigured workspace
 *    gets the "inside" template — the safe default).
 *  - null day entry ⇒ closed all day.
 *  - open ≤ close ⇒ inside when open ≤ t < close.
 *  - open > close ⇒ overnight window: inside when t ≥ open (today's
 *    entry) OR t < close of YESTERDAY's overnight entry.
 *  - open === close ⇒ zero-width window = closed.
 */
export function isInsideBusinessHours(raw: unknown, at: Date = new Date()): boolean {
  const bh = parseBusinessHours(raw);
  if (!bh) return true;
  const { dow, minutes } = localParts(at, bh.tz);

  const today = entryFor(bh, dow);
  if (today) {
    const open = parseHHMM(today.open)!;
    const close = parseHHMM(today.close)!;
    if (open < close) {
      if (minutes >= open && minutes < close) return true;
    } else if (open > close) {
      // Overnight window starts today.
      if (minutes >= open) return true;
    }
  }

  // Spill-over from yesterday's overnight window (e.g. Mon 22:00–06:00
  // covers Tue 00:00–05:59).
  const yesterday = entryFor(bh, (dow + 6) % 7);
  if (yesterday) {
    const open = parseHHMM(yesterday.open)!;
    const close = parseHHMM(yesterday.close)!;
    if (open > close && minutes < close) return true;
  }

  return false;
}

// ── The ticket.created consumer ──────────────────────────────────────

/** Atomic once-only claim via the processed_events PK (ADR-0006). */
async function claimEvent(key: string): Promise<boolean> {
  try {
    await prisma.processedEvent.create({ data: { eventId: key } });
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'P2002') return false; // already processed
    throw e;
  }
}

export async function maybeSendAutoResponse(ev: {
  id: string;
  type: string;
  accountId: string | null;
  data: unknown;
}): Promise<void> {
  if (ev.type !== 'suppuo.ticket.created.v1' || !ev.accountId) return;

  const settings = await prisma.accountSettings.findUnique({
    where: { accountId: ev.accountId },
  });
  if (!settings?.autoResponseEnabled) return;

  const inside = isInsideBusinessHours(settings.businessHours);
  const template = inside ? settings.autoResponseInside : settings.autoResponseOutside;
  const body = template?.trim();
  if (!body) return; // empty template for this window ⇒ stay silent

  const ticketId = (ev.data as { ticketId?: unknown } | null | undefined)?.ticketId;
  if (typeof ticketId !== 'string') return;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.accountId !== ev.accountId) return;

  if (!(await claimEvent(`auto_response:${ev.id}`))) return;

  // The auto-ack is a real message in the thread.
  await prisma.ticketMessage.create({
    data: {
      id: newId('tmsg'),
      ticketId: ticket.id,
      authorType: 'agent',
      authorName: AUTO_REPLY_AUTHOR,
      body,
    },
  });

  // Deliver over the ORIGIN channel — same fan-out shape as the agent
  // reply path in routes/tickets.ts. Fire-and-forget per channel.
  if (ticket.requesterEmail && (ticket.channel === 'web' || ticket.channel === 'email')) {
    void sendAgentRepliedEmail({
      accountId: ticket.accountId,
      to: ticket.requesterEmail,
      ticketNumber: ticket.number,
      subject: ticket.subject,
      accessToken: ticket.accessToken,
      replyBody: body,
      agentName: AUTO_REPLY_AUTHOR,
    }).catch((e) => console.error('[auto-response] email failed', ticket.id, e));
  }
  if (ticket.channel === 'whatsapp' && ticket.requesterPhone) {
    void resolveWhatsAppForAccount(ticket.accountId)
      .then((ch) => {
        if (!ch) {
          return console.warn('[auto-response] no whatsapp channel for', ticket.accountId);
        }
        return ch.kind === 'cloud'
          ? sendWhatsAppCloud({
              accessToken: ch.accessToken,
              phoneNumberId: ch.phoneNumberId,
              to: ticket.requesterPhone!,
              body,
            })
          : sendWhatsApp({
              to: ticket.requesterPhone!,
              body,
              accountSid: ch.creds.accountSid,
              authToken: ch.creds.authToken,
              from: ch.from,
            });
      })
      .catch((e) => console.error('[auto-response] whatsapp failed', ticket.id, e));
  }
  if (ticket.channel === 'telegram' && ticket.requesterExternalId) {
    void resolveTelegramForAccount(ticket.accountId)
      .then((ch) =>
        ch
          ? sendTelegramMessage({
              botToken: ch.botToken,
              chatId: ticket.requesterExternalId!,
              text: body,
            })
          : console.warn('[auto-response] no telegram channel for', ticket.accountId),
      )
      .catch((e) => console.error('[auto-response] telegram failed', ticket.id, e));
  }
}

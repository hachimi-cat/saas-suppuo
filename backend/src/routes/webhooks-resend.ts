import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendErr, sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { writeOutbox } from '../lib/outbox.js';
import { nextStatusOnMessage, generateAccessToken } from '../lib/ticket-flow.js';

/*
 * POST /api/v1/webhooks/resend — email-to-ticket via Resend inbound.
 *
 * Every workspace owns an inbound address `<accountId>@in.suppuo.com`
 * (customers forward their own support@ to it). Resend receives the
 * mail (MX on in.suppuo.com) and fires `email.received` here with
 * METADATA ONLY — the body is fetched separately from
 * GET /emails/receiving/:id with the platform key.
 *
 * Auth: svix-style signature (svix-id/-timestamp/-signature headers,
 * HMAC-SHA256 over `${id}.${ts}.${rawBody}` keyed with the base64
 * portion of SUPPUO_RESEND_WEBHOOK_SECRET). Idempotency: ProcessedEvent
 * on the svix message id (stable across redeliveries).
 *
 * Threading mirrors the WhatsApp webhook: latest non-closed ticket for
 * (workspace, requesterEmail) gets the message appended (re-opens per
 * the normal transition); otherwise a fresh ticket (channel=email).
 */

const router = Router();

const INBOUND_DOMAIN = process.env.SUPPUO_INBOUND_EMAIL_DOMAIN ?? 'in.suppuo.com';

export function verifySvixSignature(
  rawBody: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  secret = process.env.SUPPUO_RESEND_WEBHOOK_SECRET ?? '',
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  // Reject stale deliveries (replay window: 5 minutes).
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest('base64');
  // Header carries space-separated `v1,<sig>` entries.
  return headers.signature.split(' ').some((part) => {
    const sig = part.startsWith('v1,') ? part.slice(3) : part;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

/** `acc_01ABC…@in.suppuo.com` (any +tag tolerated) → the accountId. */
export function accountIdFromAddress(addr: string): string | null {
  const m = /^([a-z0-9_]+?)(\+[^@]*)?@(.+)$/i.exec(addr.trim());
  if (!m || (m[3] ?? '').toLowerCase() !== INBOUND_DOMAIN) return null;
  return m[1] ?? null;
}

/** Light reply-trim: drop trailing quoted chains ("On … wrote:" / "> ") so
 *  forwarded-thread replies don't bloat tickets. Conservative — only
 *  strips from the first marker line onward, never the whole body. */
export function trimQuotedReply(text: string): string {
  const lines = text.split('\n');
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const l = (lines[i] ?? '').trim();
    if (/^On .{4,80} wrote:$/.test(l) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(l)) {
      cut = i;
      break;
    }
  }
  if (cut === lines.length) {
    // All-quoted tail: trim trailing "> " lines only.
    while (cut > 0) {
      const prev = lines[cut - 1] ?? '';
      if (prev.trim() === '' || prev.startsWith('>')) cut--;
      else break;
    }
  }
  const out = lines.slice(0, cut).join('\n').trim();
  return out || text.trim();
}

async function fetchReceivedEmail(emailId: string): Promise<{ text: string | null; html: string | null } | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { text?: string | null; html?: string | null };
  return { text: body.text ?? null, html: body.html ?? null };
}

/** Crude HTML→text for senders that omit a plain part. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? '';
    const ok = verifySvixSignature(rawBody, {
      id: req.headers['svix-id'] as string | undefined,
      timestamp: req.headers['svix-timestamp'] as string | undefined,
      signature: req.headers['svix-signature'] as string | undefined,
    });
    if (!ok) return sendErr(res, req, 401, 'INVALID_SIGNATURE', 'bad svix signature');

    const event = req.body as {
      type?: string;
      data?: {
        email_id?: string;
        from?: string;
        to?: string[] | string;
        subject?: string;
      };
    };
    if (event?.type !== 'email.received' || !event.data?.email_id) {
      return sendOk(res, req, { ignored: true });
    }

    // Idempotency on the svix message id (same across redeliveries).
    const eventId = `resend:${req.headers['svix-id']}`;
    const seen = await prisma.processedEvent.findUnique({ where: { eventId } });
    if (seen) return sendOk(res, req, { duplicate: true });

    const toList = Array.isArray(event.data.to)
      ? event.data.to
      : typeof event.data.to === 'string'
        ? [event.data.to]
        : [];
    // Alias → workspace. Accounts live in Huudis (no local table), so the
    // gate is the alias format itself: `acc_` + 26-char ULID local-parts
    // are unguessable in practice. Junk to a malformed alias is dropped.
    const accountId =
      toList
        .map(accountIdFromAddress)
        .find((x): x is string => Boolean(x && /^acc_[0-9a-hjkmnp-tv-z]{26}$/i.test(x))) ?? null;
    if (!accountId) {
      // ACK 200 — Resend retries aggressively and an unknown alias will
      // never become deliverable; record + drop.
      await prisma.processedEvent.create({ data: { eventId } });
      return sendOk(res, req, { dropped: 'no workspace inbound alias matched' });
    }

    // From: may be "Name <a@b.c>" or bare.
    const fromRaw = event.data.from ?? '';
    const fromMatch = /^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/.exec(fromRaw.trim());
    const requesterEmail = fromMatch?.[2]?.toLowerCase() ?? null;
    const requesterName = fromMatch?.[1]?.trim() || null;
    if (!requesterEmail) {
      await prisma.processedEvent.create({ data: { eventId } });
      return sendOk(res, req, { dropped: 'unparseable from address' });
    }

    // Body: fetch the full received email (webhook is metadata-only).
    const full = await fetchReceivedEmail(event.data.email_id);
    const bodyText = full?.text
      ? trimQuotedReply(full.text)
      : full?.html
        ? trimQuotedReply(htmlToText(full.html))
        : '(empty message)';
    const subject = (event.data.subject ?? '').trim() || 'Email inquiry';

    const existing = await prisma.ticket.findFirst({
      where: { accountId, requesterEmail, status: { not: 'closed' } },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (existing) {
      const nextStatus = nextStatusOnMessage(existing.status as never, 'requester', false);
      await prisma.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { eventId } });
        const m = await tx.ticketMessage.create({
          data: {
            id: newId('tmsg'),
            ticketId: existing.id,
            authorType: 'requester',
            authorName: requesterName ?? requesterEmail,
            body: bodyText,
          },
        });
        await tx.ticket.update({
          where: { id: existing.id },
          data: { status: nextStatus, lastMessageAt: new Date() },
        });
        await writeOutbox(tx, {
          type: 'suppuo.ticket.replied.v1',
          accountId,
          aggregateId: existing.id,
          data: { ticketId: existing.id, messageId: m.id, isInternal: false, by: 'requester' },
        });
      });
      return sendOk(res, req, { appended: existing.id });
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({ data: { eventId } });
      const last = await tx.ticket.aggregate({ where: { accountId }, _max: { number: true } });
      const t = await tx.ticket.create({
        data: {
          id: newId('tkt'),
          accountId,
          number: (last._max.number ?? 0) + 1,
          subject: subject.slice(0, 120),
          channel: 'email',
          requesterEmail,
          requesterName,
          requesterPhone: null,
          accessToken: generateAccessToken(),
        },
      });
      await tx.ticketMessage.create({
        data: {
          id: newId('tmsg'),
          ticketId: t.id,
          authorType: 'requester',
          authorName: requesterName ?? requesterEmail,
          body: bodyText,
        },
      });
      await writeOutbox(tx, {
        type: 'suppuo.ticket.created.v1',
        accountId,
        aggregateId: t.id,
        data: { ticketId: t.id, number: t.number, subject: t.subject, channel: 'email' },
      });
      return t;
    });
    sendOk(res, req, { created: created.id, number: created.number });
  }),
);

export default router;

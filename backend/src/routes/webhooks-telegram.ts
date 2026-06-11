import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { writeOutbox } from '../lib/outbox.js';
import { nextStatusOnMessage, generateAccessToken } from '../lib/ticket-flow.js';
import { telegramWebhookSecretMatches } from '../lib/telegram.js';

/*
 * POST /api/v1/webhooks/telegram/:integrationId?secret=… — Telegram bot
 * updates become tickets (mirrors the Twilio WhatsApp webhook):
 *
 *   - latest non-closed ticket for (workspace, telegram chat id —
 *     Ticket.requesterExternalId) → append message (re-opens per the
 *     normal requester-reply transition);
 *   - none → create a fresh ticket (channel=telegram), subject from the
 *     first line, requesterName from the Telegram profile.
 *
 * Auth: a per-integration shared secret in the query string (timing-safe
 * compare against the secret minted at connect time and stored in the
 * integration's config). The URL — including ?secret= — was handed to
 * Telegram via setWebhook, so only Telegram knows it.
 *
 * Telegram posts application/json (handled by the app-level parser).
 * Non-message updates and non-text messages are acknowledged with 200
 * so Telegram doesn't retry them.
 */

const router = Router();

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
    from?: {
      id?: number;
      is_bot?: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
}

function requesterNameFrom(
  from: { first_name?: string; last_name?: string; username?: string } | undefined,
): string | null {
  if (!from) return null;
  const full = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (from.username) return `@${from.username}`;
  return null;
}

router.post(
  '/:integrationId',
  asyncHandler(async (req, res) => {
    const integration = await prisma.channelIntegration.findFirst({
      where: {
        id: String(req.params.integrationId),
        provider: 'telegram_bot',
        status: 'active',
      },
    });
    const cfg = (integration?.config ?? {}) as { webhookSecret?: string };
    if (
      !integration ||
      !telegramWebhookSecretMatches(
        cfg.webhookSecret,
        typeof req.query.secret === 'string' ? req.query.secret : undefined,
      )
    ) {
      // Same response for unknown integration and bad secret — no oracle.
      return sendErr(res, req, 401, 'AUTH_REQUIRED', 'bad webhook secret');
    }
    const accountId = integration.accountId;

    const update = (req.body ?? {}) as TelegramUpdate;
    const msg = update.message;
    const chatIdRaw = msg?.chat?.id;
    const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
    if (chatIdRaw === undefined || chatIdRaw === null || !text || msg?.from?.is_bot) {
      // Not a user text message (join events, edits, bot echoes, …) —
      // ack so Telegram doesn't retry.
      return sendOk(res, req, { ok: true, skipped: true });
    }
    const chatId = String(chatIdRaw);
    const name = requesterNameFrom(msg?.from);

    const existing = await prisma.ticket.findFirst({
      where: {
        accountId,
        channel: 'telegram',
        requesterExternalId: chatId,
        status: { not: 'closed' },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (existing) {
      const nextStatus = nextStatusOnMessage(existing.status as never, 'requester', false);
      await prisma.$transaction(async (tx) => {
        const m = await tx.ticketMessage.create({
          data: {
            id: newId('tmsg'),
            ticketId: existing.id,
            authorType: 'requester',
            authorName: name ?? `Telegram ${chatId}`,
            body: text,
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
    } else {
      const subject = (text.split('\n')[0] ?? '').slice(0, 120) || 'Telegram inquiry';
      await prisma.$transaction(async (tx) => {
        const last = await tx.ticket.aggregate({
          where: { accountId },
          _max: { number: true },
        });
        const t = await tx.ticket.create({
          data: {
            id: newId('tkt'),
            accountId,
            number: (last._max.number ?? 0) + 1,
            subject,
            channel: 'telegram',
            requesterEmail: null,
            requesterName: name,
            requesterPhone: null,
            requesterExternalId: chatId,
            accessToken: generateAccessToken(),
          },
        });
        await tx.ticketMessage.create({
          data: {
            id: newId('tmsg'),
            ticketId: t.id,
            authorType: 'requester',
            authorName: name ?? `Telegram ${chatId}`,
            body: text,
          },
        });
        await writeOutbox(tx, {
          type: 'suppuo.ticket.created.v1',
          accountId,
          aggregateId: t.id,
          data: { ticketId: t.id, number: t.number, subject: t.subject, channel: 'telegram' },
        });
      });
    }

    sendOk(res, req, { ok: true });
  }),
);

export default router;

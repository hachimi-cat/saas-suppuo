import { Router } from 'express';
import express from 'express';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { writeOutbox } from '../lib/outbox.js';
import { nextStatusOnMessage, generateAccessToken } from '../lib/ticket-flow.js';
import {
  normalizeWhatsAppFrom,
  webhookSecretMatches,
  whatsappInboundAccountId,
} from '../lib/twilio.js';

/*
 * POST /api/v1/webhooks/twilio/whatsapp?secret=… — Twilio inbound
 * WhatsApp messages become tickets:
 *
 *   - latest non-closed ticket for (workspace, phone) → append message
 *     (re-opens per the normal requester-reply transition);
 *   - none → create a fresh ticket (channel=whatsapp), subject from the
 *     first line of the message.
 *
 * Auth: shared secret in the query string (timing-safe compare) — the
 * classic Twilio signature scheme needs the account AUTH TOKEN, which
 * we don't hold (API-key-only credential). v1 routes ALL inbound to the
 * SUPPUO_TWILIO_ACCOUNT_ID workspace (one WA number); per-workspace
 * number mapping is the multi-tenant follow-up.
 *
 * Twilio posts application/x-www-form-urlencoded — parsed locally here
 * (the app-level JSON parser ignores it). Responds 200 with empty TwiML
 * so Twilio doesn't auto-reply or retry.
 */

const router = Router();

router.post(
  '/whatsapp',
  express.urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    if (!webhookSecretMatches(typeof req.query.secret === 'string' ? req.query.secret : undefined)) {
      return sendErr(res, req, 401, 'AUTH_REQUIRED', 'bad webhook secret');
    }
    const accountId = whatsappInboundAccountId();
    if (!accountId) {
      return sendErr(res, req, 503, 'NOT_CONFIGURED', 'SUPPUO_TWILIO_ACCOUNT_ID unset');
    }

    const phone = normalizeWhatsAppFrom(req.body?.From);
    const body = typeof req.body?.Body === 'string' ? req.body.Body.trim() : '';
    const name =
      typeof req.body?.ProfileName === 'string' && req.body.ProfileName.trim()
        ? req.body.ProfileName.trim()
        : null;
    if (!phone || !body) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'From (whatsapp:) and Body required');
    }

    const existing = await prisma.ticket.findFirst({
      where: { accountId, requesterPhone: phone, status: { not: 'closed' } },
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
            authorName: name ?? phone,
            body,
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
      const subject = body.split('\n')[0].slice(0, 120) || 'WhatsApp inquiry';
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
            channel: 'whatsapp',
            requesterEmail: null,
            requesterName: name,
            requesterPhone: phone,
            accessToken: generateAccessToken(),
          },
        });
        await tx.ticketMessage.create({
          data: {
            id: newId('tmsg'),
            ticketId: t.id,
            authorType: 'requester',
            authorName: name ?? phone,
            body,
          },
        });
        await writeOutbox(tx, {
          type: 'suppuo.ticket.created.v1',
          accountId,
          aggregateId: t.id,
          data: { ticketId: t.id, number: t.number, subject: t.subject, channel: 'whatsapp' },
        });
      });
    }

    // Empty TwiML — acknowledge without auto-reply.
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }),
);

export default router;

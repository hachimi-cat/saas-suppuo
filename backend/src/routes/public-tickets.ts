import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { writeOutbox } from '../lib/outbox.js';
import { nextStatusOnMessage, generateAccessToken } from '../lib/ticket-flow.js';
import { sendTicketReceivedEmail } from '../lib/email.js';

/*
 * /api/v1/public — the requester-facing, UNauthenticated surface:
 *
 *   POST /public/tickets                    submit a ticket to a
 *                                           workspace's hosted form
 *   GET  /public/tickets/:accessToken       tokenized status view
 *   POST /public/tickets/:accessToken/messages  requester reply
 *
 * Tenancy: the hosted form URL carries the workspace's accountId
 * (opaque acc_*); custom slugs come later. Internal notes are NEVER
 * exposed here. Mounted behind the shared rate limiter.
 */

const router = Router();

const submitBody = z.object({
  accountId: z.string().regex(/^acc_[a-f0-9]{24}$/),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  email: z.string().email(),
  name: z.string().trim().max(200).optional(),
});

router.post(
  '/tickets',
  asyncHandler(async (req, res) => {
    const input = submitBody.parse(req.body);

    const ticket = await prisma.$transaction(async (tx) => {
      const last = await tx.ticket.aggregate({
        where: { accountId: input.accountId },
        _max: { number: true },
      });
      const t = await tx.ticket.create({
        data: {
          id: newId('tkt'),
          accountId: input.accountId,
          number: (last._max.number ?? 0) + 1,
          subject: input.subject,
          channel: 'web',
          requesterEmail: input.email.toLowerCase(),
          requesterName: input.name ?? null,
          accessToken: generateAccessToken(),
        },
      });
      await tx.ticketMessage.create({
        data: {
          id: newId('tmsg'),
          ticketId: t.id,
          authorType: 'requester',
          authorName: input.name ?? input.email,
          body: input.body,
        },
      });
      await writeOutbox(tx, {
        type: 'suppuo.ticket.created.v1',
        accountId: input.accountId,
        aggregateId: t.id,
        data: { ticketId: t.id, number: t.number, subject: t.subject, channel: 'web' },
      });
      return t;
    });

    void sendTicketReceivedEmail({
      to: ticket.requesterEmail!,
      ticketNumber: ticket.number,
      subject: ticket.subject,
      accessToken: ticket.accessToken,
    }).catch((e) => console.error('[public-tickets] received-email failed', e));

    // The requester's only credential is the access token.
    sendCreated(res, req, {
      number: ticket.number,
      accessToken: ticket.accessToken,
    });
  }),
);

/** Tokenized status view — public messages only, no internal notes. */
router.get(
  '/tickets/:accessToken',
  asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: String(req.params.accessToken) },
      include: {
        messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');
    sendOk(res, req, {
      number: ticket.number,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        authorType: m.authorType,
        authorName: m.authorName,
        body: m.body,
        createdAt: m.createdAt,
      })),
    });
  }),
);

const replyBody = z.object({ body: z.string().trim().min(1).max(20_000) });

router.post(
  '/tickets/:accessToken/messages',
  asyncHandler(async (req, res) => {
    const input = replyBody.parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: String(req.params.accessToken) },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');

    const nextStatus = nextStatusOnMessage(ticket.status as never, 'requester', false);
    const message = await prisma.$transaction(async (tx) => {
      const m = await tx.ticketMessage.create({
        data: {
          id: newId('tmsg'),
          ticketId: ticket.id,
          authorType: 'requester',
          authorName: ticket.requesterName ?? ticket.requesterEmail,
          body: input.body,
        },
      });
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: nextStatus, lastMessageAt: new Date() },
      });
      await writeOutbox(tx, {
        type: 'suppuo.ticket.replied.v1',
        accountId: ticket.accountId,
        aggregateId: ticket.id,
        data: { ticketId: ticket.id, messageId: m.id, isInternal: false, by: 'requester' },
      });
      return m;
    });
    sendCreated(res, req, { id: message.id, status: nextStatus });
  }),
);

export default router;

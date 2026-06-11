import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { writeOutbox } from '../lib/outbox.js';
import { nextStatusOnMessage, generateAccessToken } from '../lib/ticket-flow.js';
import { sendTicketReceivedEmail } from '../lib/email.js';
import { publicAttachmentsRouter } from './attachments.js';
import {
  ATTACHMENT_META_SELECT,
  AttachmentValidationError,
  bindAttachments,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '../lib/attachments.js';

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
 *
 * CORS: this surface is also called CROSS-origin by the embeddable
 * live-chat widget (frontend/public/widget.js) running on customers'
 * own sites. Tokens are capability URLs, not cookies, so a permissive
 * `*` origin is safe here — scoped to THIS router only; the rest of
 * /api/v1 stays same-origin.
 */

const router = Router();

router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

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
      accountId: ticket.accountId,
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
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
          include: { attachments: { select: ATTACHMENT_META_SELECT } },
        },
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
        attachments: m.attachments,
      })),
    });
  }),
);

const replyBody = z.object({
  body: z.string().trim().min(1).max(20_000),
  /** Staged attachment ids (POST …/attachments first), bound to this
   *  message in the same transaction. */
  attachmentIds: z.array(z.string()).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
});

router.post(
  '/tickets/:accessToken/messages',
  asyncHandler(async (req, res) => {
    const input = replyBody.parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: String(req.params.accessToken) },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');

    const nextStatus = nextStatusOnMessage(ticket.status as never, 'requester', false);
    let message;
    try {
      message = await prisma.$transaction(async (tx) => {
        const m = await tx.ticketMessage.create({
          data: {
            id: newId('tmsg'),
            ticketId: ticket.id,
            authorType: 'requester',
            authorName: ticket.requesterName ?? ticket.requesterEmail,
            body: input.body,
          },
        });
        if (input.attachmentIds?.length) {
          await bindAttachments(tx, {
            accountId: ticket.accountId,
            messageId: m.id,
            attachmentIds: input.attachmentIds,
          });
        }
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
    } catch (e) {
      if (e instanceof AttachmentValidationError) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', e.message);
      }
      throw e;
    }
    sendCreated(res, req, { id: message.id, status: nextStatus });
  }),
);

/** Attachment staging + token-scoped download — shares this router's
 *  CORS headers (the widget uploads cross-origin) + rate limit. */
router.use(publicAttachmentsRouter);

export default router;

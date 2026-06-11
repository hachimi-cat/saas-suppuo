import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { writeOutbox } from '../lib/outbox.js';
import {
  nextStatusOnMessage,
  generateAccessToken,
  isTicketStatus,
  isTicketPriority,
  TICKET_STATUSES,
} from '../lib/ticket-flow.js';
import { normalizeTags, buildTicketListWhere } from '../lib/ticket-query.js';
import { encodeCursor, decodeCursor } from '../lib/cursor.js';
import { sendAgentRepliedEmail, sendTicketReceivedEmail } from '../lib/email.js';
import { sendWhatsApp } from '../lib/twilio.js';
import { sendWhatsAppCloud } from '../lib/whatsapp-cloud.js';
import { sendTelegramMessage } from '../lib/telegram.js';
import { resolveWhatsAppForAccount, resolveTelegramForAccount } from '../lib/channels.js';
import { meterWhatsAppSend } from '../lib/usage.js';
import {
  ATTACHMENT_META_SELECT,
  AttachmentValidationError,
  bindAttachments,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '../lib/attachments.js';

/*
 * /api/v1/tickets — the agent workspace surface (behind requireAuth;
 * accountId = the workspace from the BFF session / Bearer claims).
 */

const router = Router();

const listQuery = z.object({
  status: z.enum([...TICKET_STATUSES, 'all'] as const).optional(),
  /** Huudis sub, or 'me' (the caller), or 'unassigned'. */
  assignee: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  channel: z.enum(['web', 'email', 'whatsapp', 'telegram']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  /** Free-text search: subject + requester email/name + message bodies. */
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuery.parse(req.query);
    const { status = 'all', limit = 50 } = query;
    const accountId = req.auth!.accountId as string;

    const where = buildTicketListWhere({
      accountId,
      status,
      assignee: query.assignee,
      tag: query.tag,
      channel: query.channel,
      priority: query.priority,
      q: query.q,
      viewerSub: req.auth!.sub,
    });

    // Cursor keyset on the list order (lastMessageAt desc, id desc) —
    // the shared codec's `createdAt` slot carries lastMessageAt here.
    const cursor = decodeCursor(query.cursor);
    const cursorWhere = cursor
      ? {
          OR: [
            { lastMessageAt: { lt: new Date(cursor.createdAt) } },
            { lastMessageAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ],
        }
      : null;

    const tickets = await prisma.ticket.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = tickets.length > limit;
    const page = hasMore ? tickets.slice(0, limit) : tickets;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.lastMessageAt.toISOString(), id: last.id })
        : null;

    const counts = await prisma.ticket.groupBy({
      by: ['status'],
      where: { accountId },
      _count: { _all: true },
    });
    sendOk(res, req, {
      tickets: page,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      cursor: nextCursor,
      hasMore,
    });
  }),
);

/** Distinct tags across the workspace's tickets — autocomplete feed.
 *  (Must be mounted before /:id so 'tags' isn't read as a ticket id.) */
router.get(
  '/tags',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const rows = await prisma.ticket.findMany({
      where: { accountId, NOT: { tags: { isEmpty: true } } },
      select: { tags: true },
    });
    const tags = [...new Set(rows.flatMap((r) => r.tags))].sort();
    sendOk(res, req, { tags });
  }),
);

const createBody = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  requesterEmail: z.string().email(),
  requesterName: z.string().trim().max(200).optional(),
  priority: z.string().optional(),
  channel: z.enum(['web', 'email', 'whatsapp']).optional(),
});

/** Agent-created ticket (logging an inquiry that arrived out-of-band,
 *  e.g. WhatsApp). The requester still gets the status-link email. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createBody.parse(req.body);
    const accountId = req.auth!.accountId as string;
    const priority = isTicketPriority(body.priority) ? body.priority : 'normal';

    const ticket = await prisma.$transaction(async (tx) => {
      const last = await tx.ticket.aggregate({
        where: { accountId },
        _max: { number: true },
      });
      const t = await tx.ticket.create({
        data: {
          id: newId('tkt'),
          accountId,
          number: (last._max.number ?? 0) + 1,
          subject: body.subject,
          priority,
          channel: body.channel ?? 'whatsapp',
          requesterEmail: body.requesterEmail.toLowerCase(),
          requesterName: body.requesterName ?? null,
          accessToken: generateAccessToken(),
        },
      });
      await tx.ticketMessage.create({
        data: {
          id: newId('tmsg'),
          ticketId: t.id,
          authorType: 'requester',
          authorName: body.requesterName ?? body.requesterEmail,
          body: body.body,
        },
      });
      await writeOutbox(tx, {
        type: 'suppuo.ticket.created.v1',
        accountId,
        aggregateId: t.id,
        data: { ticketId: t.id, number: t.number, subject: t.subject, channel: t.channel },
      });
      return t;
    });

    if (ticket.requesterEmail) {
      void sendTicketReceivedEmail({
        accountId: ticket.accountId,
        to: ticket.requesterEmail,
        ticketNumber: ticket.number,
        subject: ticket.subject,
        accessToken: ticket.accessToken,
      }).catch((e) => console.error('[tickets] received-email failed', e));
    }

    sendCreated(res, req, ticket);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const ticket = await prisma.ticket.findFirst({
      where: { id: String(req.params.id), accountId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { attachments: { select: ATTACHMENT_META_SELECT } },
        },
      },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');
    sendOk(res, req, ticket);
  }),
);

const messageBody = z.object({
  body: z.string().trim().min(1).max(20_000),
  isInternal: z.boolean().optional(),
  authorName: z.string().trim().max(200).optional(),
  /** Staged attachment ids (POST /api/v1/attachments first), bound to
   *  this message in the same transaction. */
  attachmentIds: z.array(z.string()).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
});

router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const input = messageBody.parse(req.body);
    const ticket = await prisma.ticket.findFirst({
      where: { id: String(req.params.id), accountId },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');

    const isInternal = input.isInternal ?? false;
    const nextStatus = nextStatusOnMessage(
      ticket.status as never,
      'agent',
      isInternal,
    );

    let message;
    try {
      message = await prisma.$transaction(async (tx) => {
        const m = await tx.ticketMessage.create({
          data: {
            id: newId('tmsg'),
            ticketId: ticket.id,
            authorType: 'agent',
            authorSub: req.auth!.sub,
            authorName: input.authorName ?? null,
            body: input.body,
            isInternal,
          },
        });
        if (input.attachmentIds?.length) {
          await bindAttachments(tx, {
            accountId,
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
          accountId,
          aggregateId: ticket.id,
          data: { ticketId: ticket.id, messageId: m.id, isInternal, by: 'agent' },
        });
        return m;
      });
    } catch (e) {
      if (e instanceof AttachmentValidationError) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', e.message);
      }
      throw e;
    }

    if (!isInternal) {
      if (ticket.requesterEmail) {
        void sendAgentRepliedEmail({
          accountId: ticket.accountId,
          to: ticket.requesterEmail,
          ticketNumber: ticket.number,
          subject: ticket.subject,
          accessToken: ticket.accessToken,
          replyBody: input.body,
          agentName: input.authorName ?? null,
        }).catch((e) => console.error('[tickets] replied-email failed', e));
      }
      if (ticket.channel === 'whatsapp' && ticket.requesterPhone) {
        void resolveWhatsAppForAccount(ticket.accountId)
          .then((ch) => {
            if (!ch) {
              return console.warn('[tickets] no whatsapp channel for', ticket.accountId);
            }
            const sent =
              ch.kind === 'cloud'
                ? sendWhatsAppCloud({
                    accessToken: ch.accessToken,
                    phoneNumberId: ch.phoneNumberId,
                    to: ticket.requesterPhone!,
                    body: input.body,
                  })
                : sendWhatsApp({
                    to: ticket.requesterPhone!,
                    body: input.body,
                    accountSid: ch.creds.accountSid,
                    authToken: ch.creds.authToken,
                    from: ch.from,
                  });
            return sent.then((r) => {
              meterWhatsAppSend(ticket.accountId, ch);
              return r;
            });
          })
          .catch((e) => console.error('[tickets] whatsapp reply failed', e));
      }
      if (ticket.channel === 'telegram' && ticket.requesterExternalId) {
        void resolveTelegramForAccount(ticket.accountId)
          .then((ch) =>
            ch
              ? sendTelegramMessage({
                  botToken: ch.botToken,
                  chatId: ticket.requesterExternalId!,
                  text: input.body,
                })
              : console.warn('[tickets] no telegram channel for', ticket.accountId),
          )
          .catch((e) => console.error('[tickets] telegram reply failed', e));
      }
    }

    sendCreated(res, req, { message, status: nextStatus });
  }),
);

const patchBody = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeSub: z.string().nullable().optional(),
  tags: z.array(z.string().max(200)).max(100).optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const input = patchBody.parse(req.body);
    const ticket = await prisma.ticket.findFirst({
      where: { id: String(req.params.id), accountId },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');

    const data: Record<string, unknown> = {};
    if (input.status !== undefined) {
      if (!isTicketStatus(input.status)) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', `status must be one of ${TICKET_STATUSES.join(', ')}`);
      }
      data.status = input.status;
    }
    if (input.priority !== undefined) {
      if (!isTicketPriority(input.priority)) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', 'invalid priority');
      }
      data.priority = input.priority;
    }
    if (input.assigneeSub !== undefined) data.assigneeSub = input.assigneeSub;
    if (input.tags !== undefined) data.tags = normalizeTags(input.tags);
    if (Object.keys(data).length === 0) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'nothing to update');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.update({ where: { id: ticket.id }, data });
      if (data.status && data.status !== ticket.status) {
        await writeOutbox(tx, {
          type: 'suppuo.ticket.status_changed.v1',
          accountId,
          aggregateId: ticket.id,
          data: { ticketId: ticket.id, from: ticket.status, to: data.status },
        });
      }
      return t;
    });
    sendOk(res, req, updated);
  }),
);

export default router;

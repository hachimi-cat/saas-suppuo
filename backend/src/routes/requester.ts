import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, ApiError } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { writeOutbox } from '../lib/outbox.js';
import { nextStatusOnMessage, generateAccessToken } from '../lib/ticket-flow.js';
import { sendTicketReceivedEmail } from '../lib/email.js';

/*
 * /api/v1/requester — the authenticated, customer-facing "my tickets"
 * API behind requireRequester. Every query is scoped to the requester's
 * (accountId, email) — a requester can only ever see and act on their
 * own tickets in one workspace. Powers BOTH the embedded in-product
 * support center and the hosted suppuo.com/portal/<acc>.
 *
 * Status groups (DO-style): "open" = open|pending, "resolved" =
 * resolved|closed.
 */

const router = Router();

const OPEN = ['open', 'pending'];
const RESOLVED = ['resolved', 'closed'];

function scope(req: { requester?: { accountId: string; email: string } }) {
  const r = req.requester!;
  return { accountId: r.accountId, requesterEmail: r.email };
}

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const r = req.requester!;
    sendOk(res, req, { email: r.email, accountId: r.accountId });
  }),
);

const listQuery = z.object({ status: z.enum(['open', 'resolved', 'all']).default('all') });

router.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const { status } = listQuery.parse(req.query);
    const base = scope(req);
    const statusFilter =
      status === 'open' ? { in: OPEN } : status === 'resolved' ? { in: RESOLVED } : undefined;

    const [tickets, openCount, resolvedCount] = await Promise.all([
      prisma.ticket.findMany({
        where: { ...base, ...(statusFilter ? { status: statusFilter } : {}) },
        orderBy: { lastMessageAt: 'desc' },
        select: {
          number: true,
          subject: true,
          status: true,
          createdAt: true,
          lastMessageAt: true,
        },
        take: 200,
      }),
      prisma.ticket.count({ where: { ...base, status: { in: OPEN } } }),
      prisma.ticket.count({ where: { ...base, status: { in: RESOLVED } } }),
    ]);

    sendOk(res, req, {
      tickets,
      counts: { open: openCount, resolved: resolvedCount },
    });
  }),
);

router.get(
  '/tickets/:number',
  asyncHandler(async (req, res) => {
    const number = Number(req.params.number);
    if (!Number.isInteger(number)) throw new ApiError(400, 'VALIDATION_ERROR', 'bad ticket number');
    const base = scope(req);
    const ticket = await prisma.ticket.findFirst({
      where: { ...base, number },
      include: {
        messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new ApiError(404, 'NOT_FOUND', 'ticket not found');
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
  '/tickets/:number/messages',
  asyncHandler(async (req, res) => {
    const number = Number(req.params.number);
    if (!Number.isInteger(number)) throw new ApiError(400, 'VALIDATION_ERROR', 'bad ticket number');
    const input = replyBody.parse(req.body);
    const base = scope(req);
    const ticket = await prisma.ticket.findFirst({ where: { ...base, number } });
    if (!ticket) throw new ApiError(404, 'NOT_FOUND', 'ticket not found');

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
        type: 'suppuo.ticket.message.created.v1',
        accountId: ticket.accountId,
        aggregateId: ticket.id,
        data: { ticketId: ticket.id, number: ticket.number, authorType: 'requester' },
      });
      return m;
    });
    sendCreated(res, req, { id: message.id, createdAt: message.createdAt });
  }),
);

const createBody = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
});

router.post(
  '/tickets',
  asyncHandler(async (req, res) => {
    const input = createBody.parse(req.body);
    const r = req.requester!;
    const ticket = await prisma.$transaction(async (tx) => {
      const last = await tx.ticket.aggregate({
        where: { accountId: r.accountId },
        _max: { number: true },
      });
      const t = await tx.ticket.create({
        data: {
          id: newId('tkt'),
          accountId: r.accountId,
          number: (last._max.number ?? 0) + 1,
          subject: input.subject,
          channel: 'web',
          requesterEmail: r.email,
          accessToken: generateAccessToken(),
        },
      });
      await tx.ticketMessage.create({
        data: {
          id: newId('tmsg'),
          ticketId: t.id,
          authorType: 'requester',
          authorName: r.email,
          body: input.body,
        },
      });
      await writeOutbox(tx, {
        type: 'suppuo.ticket.created.v1',
        accountId: r.accountId,
        aggregateId: t.id,
        data: { ticketId: t.id, number: t.number, subject: t.subject, channel: 'web' },
      });
      return t;
    });

    void sendTicketReceivedEmail({
      accountId: ticket.accountId,
      to: r.email,
      ticketNumber: ticket.number,
      subject: ticket.subject,
      accessToken: ticket.accessToken,
    }).catch((e) => console.error('[requester] received-email failed', e));

    sendCreated(res, req, { number: ticket.number });
  }),
);

export default router;

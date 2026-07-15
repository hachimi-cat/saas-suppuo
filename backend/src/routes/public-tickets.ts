import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { writeOutbox } from '../lib/outbox.js';
import { nextStatusOnMessage, generateAccessToken } from '../lib/ticket-flow.js';
import { sendTicketReceivedEmail } from '../lib/email.js';
import { accountHidesBranding } from '../lib/branding.js';
import { resolveAccountId } from '../lib/resolve-account.js';
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
  // x-e2e-bypass: every Forjio product's Playwright suite injects this
  // header on ALL requests (setExtraHTTPHeaders is context-global), so a
  // dashboard page embedding the widget trips CORS preflight on it and
  // fails the suite's zero-console-error gate. Allowing it here is inert —
  // this public surface never reads it (2026-07-15, found by ripllo's
  // first Depllo-run e2e).
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename, x-e2e-bypass');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const submitBody = z.object({
  // A handle: a raw acc_… id OR a workspace slug (resolved in the handler).
  accountId: z.string().trim().min(3).max(64),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  email: z.string().email(),
  name: z.string().trim().max(200).optional(),
  // Honeypot — a hidden field real users never fill but form-scraping
  // bots auto-complete. Any non-empty value = bot → silently dropped.
  company: z.string().max(300).optional(),
});

// ── Per-IP rate limit for the public ticket POST ──────────────────────
// In-process sliding window (suppuo runs a single pm2 worker; resets on
// restart, which is fine for spam/abuse defense). The shared rateLimit()
// middleware is a header-only skeleton, so the public submit endpoint
// enforces its own real limit. 2026-06-16.
const RL_SOFT_MS = 10 * 60 * 1000; // 10 min window
const RL_SOFT_MAX = 5; // ≤5 tickets/IP/10min
const RL_HARD_MS = 60 * 60 * 1000; // 1 h window
const RL_HARD_MAX = 20; // ≤20 tickets/IP/h
const ipHits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0]!.trim();
  return req.ip || 'unknown';
}

/** True if this IP is over the limit (and does not record the hit). */
function ticketRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RL_HARD_MS);
  const recent = hits.filter((t) => now - t < RL_SOFT_MS);
  if (recent.length >= RL_SOFT_MAX || hits.length >= RL_HARD_MAX) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

// Opportunistic sweep so the IP map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of ipHits) {
    const live = hits.filter((t) => now - t < RL_HARD_MS);
    if (live.length === 0) ipHits.delete(ip);
    else ipHits.set(ip, live);
  }
}, RL_HARD_MS).unref();

/** Pre-ticket config for the embeddable widget + hosted form (the
 *  branding footer renders before any ticket exists). No secrets. */
router.get(
  '/widget-config',
  asyncHandler(async (req, res) => {
    const handle = typeof req.query.account === 'string' ? req.query.account : '';
    const account = await resolveAccountId(handle);
    if (!account) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'account required (acc_… or slug)');
    }
    const settings = await prisma.accountSettings.findUnique({ where: { accountId: account } });
    sendOk(res, req, {
      hideBranding: settings?.hideBranding ?? false,
      // The widget bubble + panel accent follow the workspace brand.
      accentColor: settings?.accentColor ?? null,
    });
  }),
);

router.post(
  '/tickets',
  asyncHandler(async (req, res) => {
    const input = submitBody.parse(req.body);

    // Honeypot — a bot filled the hidden field. Pretend it worked (so it
    // doesn't retry / probe) but create nothing.
    if (input.company && input.company.trim().length > 0) {
      return sendCreated(res, req, { number: 0, accessToken: generateAccessToken() });
    }

    // Per-IP rate limit — spam/abuse defense on the open endpoint.
    if (ticketRateLimited(clientIp(req))) {
      return sendErr(
        res,
        req,
        429,
        'RATE_LIMITED',
        'Too many requests — please wait a little before submitting again.',
      );
    }

    // Resolve the handle (acc_… or slug) to the real workspace id.
    const accountId = await resolveAccountId(input.accountId);
    if (!accountId) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'unknown workspace');
    }

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
        accountId,
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
    // Feature wave: CSAT — let the thread page know whether this
    // (resolved) ticket was already rated.
    const csat = await prisma.csatResponse.findUnique({
      where: { ticketId: ticket.id },
      select: { score: true, comment: true },
    });
    sendOk(res, req, {
      number: ticket.number,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
      csat,
      hideBranding: await accountHidesBranding(ticket.accountId),
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

// ─── Feature wave: CSAT + automation ───
// Tokenized rating submission — the email's one-click links and the
// thread page's "How did we do?" block both land here. Upsert (the
// requester may change their mind), but only once the ticket is
// actually resolved/closed.
const csatBody = z.object({
  score: z.number().int().min(1).max(3),
  comment: z.string().trim().max(2000).optional(),
});

router.post(
  '/tickets/:accessToken/csat',
  asyncHandler(async (req, res) => {
    const input = csatBody.parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: String(req.params.accessToken) },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      return sendErr(
        res,
        req,
        409,
        'CONFLICT',
        'ratings open once the ticket is resolved',
      );
    }
    const saved = await prisma.csatResponse.upsert({
      where: { ticketId: ticket.id },
      create: {
        id: newId('csat'),
        accountId: ticket.accountId,
        ticketId: ticket.id,
        score: input.score,
        comment: input.comment ?? null,
      },
      update: {
        score: input.score,
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    });
    sendOk(res, req, { score: saved.score, comment: saved.comment });
  }),
);

/** Attachment staging + token-scoped download — shares this router's
 *  CORS headers (the widget uploads cross-origin) + rate limit. */
router.use(publicAttachmentsRouter);

export default router;

import { Router } from 'express';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/db.js';
import { sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import {
  AttachmentValidationError,
  createStagedAttachment,
  dispositionFor,
  MAX_ATTACHMENT_BYTES,
} from '../lib/attachments.js';

/*
 * Ticket-message attachments — upload (staging) + download.
 *
 * Two surfaces share this file:
 *
 *   Agent (requireAuth, mounted at /api/v1/attachments):
 *     POST /api/v1/attachments              stage an upload (raw body +
 *                                           x-filename header) → meta
 *     GET  /api/v1/attachments/:id          account-scoped download
 *
 *   Public (token capability, mounted INSIDE routes/public-tickets.ts
 *   so it inherits the widget CORS headers + the ingress rate limit):
 *     POST /api/v1/public/tickets/:accessToken/attachments
 *     GET  /api/v1/public/tickets/:accessToken/attachments/:id
 *           (only attachments bound to a PUBLIC message of THAT ticket)
 *
 * Staged rows (messageId = null) are bound to a message by the
 * message-create handlers (attachmentIds in the payload, same
 * transaction); unbound rows older than 1h are swept by the outbox
 * worker tick. Bytes live in Postgres in v1 (8MB/file, 5/message).
 * // TODO: DO Spaces when volume demands
 */

/** Raw-body parser scoped to the upload routes only — accepts any
 *  content type; validation happens against the allowlist after. The
 *  9mb parser limit leaves headroom so our own 8MB check (and its
 *  clean error message) is what callers actually hit. */
const rawBody = express.raw({ limit: '9mb', type: () => true });

function resolveFilename(req: Request): string | null {
  const raw = req.headers['x-filename'];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

async function stageUpload(req: Request, res: Response, accountId: string): Promise<void> {
  const filename = resolveFilename(req);
  if (!filename) {
    sendErr(res, req, 400, 'VALIDATION_ERROR', 'x-filename header required');
    return;
  }
  const contentType = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (!contentType) {
    sendErr(res, req, 400, 'VALIDATION_ERROR', 'Content-Type header required');
    return;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    sendErr(res, req, 400, 'VALIDATION_ERROR', 'empty upload body');
    return;
  }
  const meta = await createStagedAttachment({
    accountId,
    filename,
    contentType,
    data: req.body,
  });
  sendCreated(res, req, meta);
}

function streamAttachment(
  res: Response,
  att: { filename: string; contentType: string; size: number; data: Uint8Array },
): void {
  res.status(200);
  res.setHeader('Content-Type', att.contentType);
  res.setHeader('Content-Length', String(att.size));
  res.setHeader('Content-Disposition', dispositionFor(att.contentType, att.filename));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.end(Buffer.from(att.data));
}

/** Maps oversized-body aborts (the 9mb parser limit) + validation
 *  rejections to clean envelopes instead of the generic 500. */
function attachmentErrors(e: unknown, req: Request, res: Response, next: NextFunction): void {
  if (e instanceof AttachmentValidationError) {
    sendErr(res, req, 400, 'VALIDATION_ERROR', e.message);
    return;
  }
  if (e && typeof e === 'object' && (e as { type?: string }).type === 'entity.too.large') {
    sendErr(
      res,
      req,
      413,
      'VALIDATION_ERROR',
      `file exceeds the ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB limit`,
    );
    return;
  }
  next(e);
}

// ─── Agent surface (mounted behind requireAuth) ──────────────────────

const router = Router();

router.post(
  '/',
  rawBody,
  asyncHandler(async (req, res) => {
    await stageUpload(req, res, req.auth!.accountId as string);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const att = await prisma.attachment.findFirst({
      where: { id: String(req.params.id), accountId },
    });
    if (!att) return sendErr(res, req, 404, 'NOT_FOUND', 'attachment not found');
    streamAttachment(res, att);
  }),
);

router.use(attachmentErrors);

export default router;

// ─── Public surface (mounted inside routes/public-tickets.ts) ────────

export const publicAttachmentsRouter = Router();

publicAttachmentsRouter.post(
  '/tickets/:accessToken/attachments',
  rawBody,
  asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: String(req.params.accessToken) },
      select: { accountId: true },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');
    await stageUpload(req, res, ticket.accountId);
  }),
);

publicAttachmentsRouter.get(
  '/tickets/:accessToken/attachments/:id',
  asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: String(req.params.accessToken) },
      select: { id: true },
    });
    if (!ticket) return sendErr(res, req, 404, 'NOT_FOUND', 'ticket not found');
    // Only attachments bound to a PUBLIC message of THIS ticket —
    // staged rows and internal-note attachments are never served here.
    const att = await prisma.attachment.findFirst({
      where: {
        id: String(req.params.id),
        message: { ticketId: ticket.id, isInternal: false },
      },
    });
    if (!att) return sendErr(res, req, 404, 'NOT_FOUND', 'attachment not found');
    streamAttachment(res, att);
  }),
);

publicAttachmentsRouter.use(attachmentErrors);

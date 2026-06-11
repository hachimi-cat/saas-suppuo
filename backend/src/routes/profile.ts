import { Router } from 'express';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/db.js';
import { sendErr, sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';

/*
 * Agent profile — avatar only. Display name lives in Huudis and is
 * edited via the /api/v1/huudis/account proxy; the avatar has no home
 * in Huudis (no field on its User model), so it lives in a thin
 * suppuo-local record keyed by the Huudis sub (prisma AgentProfile).
 *
 * Mounted at /api/v1/profile behind requireAuth:
 *   PUT    /avatar       upsert OWN avatar (raw image body, 1MB cap,
 *                        png/jpeg/webp only — there is no sub param on
 *                        write; you can only write your own)
 *   DELETE /avatar       remove own avatar (idempotent)
 *   GET    /avatar/:sub  any authenticated member can fetch any sub's
 *                        avatar — it's just a profile picture
 */

export const MAX_AVATAR_BYTES = 1 * 1024 * 1024; // 1MB

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** Raw-body parser scoped to the avatar upload route only — accepts any
 *  content type; validation happens against the allowlist after. The
 *  2mb parser limit leaves headroom so our own 1MB check (and its
 *  clean error message) is what callers actually hit. */
const rawBody = express.raw({ limit: '2mb', type: () => true });

const router = Router();

router.put(
  '/avatar',
  rawBody,
  asyncHandler(async (req, res) => {
    const contentType = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      return sendErr(
        res,
        req,
        400,
        'VALIDATION_ERROR',
        'avatar must be image/png, image/jpeg or image/webp',
      );
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'empty upload body');
    }
    if (req.body.length > MAX_AVATAR_BYTES) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'avatar exceeds the 1MB limit');
    }
    // Always the CALLER's sub — writes are self-only by construction.
    const sub = req.auth!.sub as string;
    const bytes = new Uint8Array(req.body);
    const row = await prisma.agentProfile.upsert({
      where: { sub },
      create: { sub, avatar: bytes, contentType },
      update: { avatar: bytes, contentType },
      select: { sub: true, contentType: true, updatedAt: true },
    });
    sendOk(res, req, row);
  }),
);

router.delete(
  '/avatar',
  asyncHandler(async (req, res) => {
    // Idempotent — deleting an avatar that doesn't exist is a no-op.
    await prisma.agentProfile.deleteMany({ where: { sub: req.auth!.sub as string } });
    sendOk(res, req, { deleted: true });
  }),
);

router.get(
  '/avatar/:sub',
  asyncHandler(async (req, res) => {
    const row = await prisma.agentProfile.findUnique({
      where: { sub: String(req.params.sub) },
    });
    if (!row) return sendErr(res, req, 404, 'NOT_FOUND', 'no avatar');
    res.status(200);
    res.setHeader('Content-Type', row.contentType);
    res.setHeader('Content-Length', String(row.avatar.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(Buffer.from(row.avatar));
  }),
);

/** Maps oversized-body aborts (the 2mb parser limit) to a clean
 *  envelope instead of the generic 500. */
function profileErrors(e: unknown, req: Request, res: Response, next: NextFunction): void {
  if (e && typeof e === 'object' && (e as { type?: string }).type === 'entity.too.large') {
    sendErr(res, req, 413, 'VALIDATION_ERROR', 'avatar exceeds the 1MB limit');
    return;
  }
  next(e);
}

router.use(profileErrors);

export default router;

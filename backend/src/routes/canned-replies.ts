import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';

// /api/v1/canned-replies — per-workspace saved reply snippets.

const router = Router();

const upsertBody = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20_000),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await prisma.cannedReply.findMany({
      where: { accountId: req.auth!.accountId as string },
      orderBy: { title: 'asc' },
    });
    sendOk(res, req, { cannedReplies: rows });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = upsertBody.parse(req.body);
    const row = await prisma.cannedReply.create({
      data: {
        id: newId('cnr'),
        accountId: req.auth!.accountId as string,
        title: input.title,
        body: input.body,
      },
    });
    sendCreated(res, req, row);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = upsertBody.partial().parse(req.body);
    const accountId = req.auth!.accountId as string;
    const existing = await prisma.cannedReply.findFirst({
      where: { id: String(req.params.id), accountId },
    });
    if (!existing) return sendErr(res, req, 404, 'NOT_FOUND', 'canned reply not found');
    const row = await prisma.cannedReply.update({
      where: { id: existing.id },
      data: input,
    });
    sendOk(res, req, row);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const existing = await prisma.cannedReply.findFirst({
      where: { id: String(req.params.id), accountId },
    });
    if (!existing) return sendErr(res, req, 404, 'NOT_FOUND', 'canned reply not found');
    await prisma.cannedReply.delete({ where: { id: existing.id } });
    sendOk(res, req, { deleted: true });
  }),
);

export default router;

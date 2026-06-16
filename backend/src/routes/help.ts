import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, ApiError } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';

/*
 * /api/v1/help — portal-side management of the help-center knowledge
 * base (FAQ + articles), behind requireAuth and scoped to the caller's
 * workspace. The public read surface lives under /public/help.
 *
 * One model (HelpArticle) with kind 'faq' (title=question, body=answer)
 * or 'article' (title + markdown body). Articles carry a URL slug; FAQ
 * rows leave it null.
 */

const router = Router();

const KINDS = ['faq', 'article'] as const;
const STATUSES = ['draft', 'published'] as const;

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createBody = z.object({
  kind: z.enum(KINDS).default('faq'),
  slug: z.string().trim().toLowerCase().regex(slugRe, 'lowercase-kebab slug').max(120).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(50_000),
  status: z.enum(STATUSES).default('draft'),
  position: z.number().int().min(0).max(100_000).optional(),
});

const patchBody = z.object({
  kind: z.enum(KINDS).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugRe, 'lowercase-kebab slug')
    .max(120)
    .nullable()
    .optional(),
  category: z.string().trim().max(80).nullable().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  body: z.string().trim().min(1).max(50_000).optional(),
  status: z.enum(STATUSES).optional(),
  position: z.number().int().min(0).max(100_000).optional(),
});

interface ArticleRow {
  id: string;
  kind: string;
  slug: string | null;
  category: string | null;
  title: string;
  body: string;
  status: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

function view(a: ArticleRow) {
  return {
    id: a.id,
    kind: a.kind,
    slug: a.slug,
    category: a.category,
    title: a.title,
    body: a.body,
    status: a.status,
    position: a.position,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

router.get(
  '/articles',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const rows = await prisma.helpArticle.findMany({
      where: { accountId },
      orderBy: [{ kind: 'asc' }, { position: 'asc' }, { updatedAt: 'desc' }],
    });
    sendOk(res, req, { articles: rows.map(view) });
  }),
);

router.post(
  '/articles',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const input = createBody.parse(req.body);
    if (input.kind === 'article' && !input.slug) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'articles require a slug');
    }
    try {
      const row = await prisma.helpArticle.create({
        data: {
          id: newId('hlp'),
          accountId,
          kind: input.kind,
          slug: input.slug ?? null,
          category: input.category ?? null,
          title: input.title,
          body: input.body,
          status: input.status,
          position: input.position ?? 0,
        },
      });
      sendCreated(res, req, view(row));
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ApiError(409, 'CONFLICT', 'an item with that slug already exists');
      }
      throw e;
    }
  }),
);

router.get(
  '/articles/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const row = await prisma.helpArticle.findFirst({
      where: { id: String(req.params.id), accountId },
    });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'article not found');
    sendOk(res, req, view(row));
  }),
);

router.patch(
  '/articles/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const input = patchBody.parse(req.body);
    const existing = await prisma.helpArticle.findFirst({
      where: { id: String(req.params.id), accountId },
    });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'article not found');

    const data: Record<string, unknown> = {};
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.category !== undefined) data.category = input.category;
    if (input.title !== undefined) data.title = input.title;
    if (input.body !== undefined) data.body = input.body;
    if (input.status !== undefined) data.status = input.status;
    if (input.position !== undefined) data.position = input.position;

    const finalKind = (data.kind as string) ?? existing.kind;
    const finalSlug = data.slug !== undefined ? (data.slug as string | null) : existing.slug;
    if (finalKind === 'article' && !finalSlug) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'articles require a slug');
    }

    try {
      const row = await prisma.helpArticle.update({
        where: { id: existing.id },
        data,
      });
      sendOk(res, req, view(row));
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ApiError(409, 'CONFLICT', 'an item with that slug already exists');
      }
      throw e;
    }
  }),
);

router.delete(
  '/articles/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const { count } = await prisma.helpArticle.deleteMany({
      where: { id: String(req.params.id), accountId },
    });
    if (count === 0) throw new ApiError(404, 'NOT_FOUND', 'article not found');
    sendOk(res, req, { deleted: true });
  }),
);

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

export default router;

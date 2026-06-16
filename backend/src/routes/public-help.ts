import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { helpSearch } from '../lib/help-search.js';

/*
 * /api/v1/public/help — the unauthenticated read surface for the hosted
 * help center (suppuo.com/support/<acc>). Serves only PUBLISHED content
 * + the public contact profile + the product deep-links. The accountId
 * (unguessable Huudis id) is the gate — same model as the public ticket
 * form. No PII beyond what the workspace chose to publish.
 */

const router = Router();

const ACCOUNT_ID_RE = /^acc_[0-9A-Za-z]{24,28}$/;

function badAccount(accountId: string): boolean {
  return !ACCOUNT_ID_RE.test(accountId);
}

function faqView(a: {
  id: string;
  category: string | null;
  title: string;
  body: string;
  position: number;
}) {
  return { id: a.id, category: a.category, question: a.title, answer: a.body, position: a.position };
}

function articleCardView(a: {
  id: string;
  slug: string | null;
  category: string | null;
  title: string;
  body: string;
}) {
  const flat = a.body.replace(/\s+/g, ' ').trim();
  return {
    id: a.id,
    slug: a.slug,
    category: a.category,
    title: a.title,
    excerpt: flat.slice(0, 160) + (flat.length > 160 ? '…' : ''),
  };
}

// GET /public/help/:accountId — the help-center bundle.
router.get(
  '/:accountId',
  asyncHandler(async (req, res) => {
    const accountId = String(req.params.accountId);
    if (badAccount(accountId)) {
      return sendOk(res, req, emptyBundle());
    }
    const [settings, faqs, articles] = await Promise.all([
      prisma.accountSettings.findUnique({ where: { accountId } }),
      prisma.helpArticle.findMany({
        where: { accountId, kind: 'faq', status: 'published' },
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      }),
      prisma.helpArticle.findMany({
        where: { accountId, kind: 'article', status: 'published' },
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      }),
    ]);

    sendOk(res, req, {
      contact: {
        email: settings?.contactEmail ?? null,
        phone: settings?.contactPhone ?? null,
        address: settings?.contactAddress ?? null,
        // The product's own /contact + /docs pages when configured.
        contactUrl: settings?.contactUrl ?? null,
        docsUrl: settings?.docsUrl ?? null,
      },
      intro: settings?.helpIntro ?? null,
      hideBranding: settings?.hideBranding ?? false,
      faqs: faqs.map(faqView),
      articles: articles.map(articleCardView),
    });
  }),
);

// GET /public/help/:accountId/search?q= — keyword search over published
// FAQ + articles (Catentio AI swaps in behind helpSearch later).
const searchQuery = z.object({ q: z.string().trim().max(200).default('') });
router.get(
  '/:accountId/search',
  asyncHandler(async (req, res) => {
    const accountId = String(req.params.accountId);
    const { q } = searchQuery.parse(req.query);
    if (badAccount(accountId) || !q) {
      return sendOk(res, req, { query: q, hits: [] });
    }
    const hits = await helpSearch.search(accountId, q, 10);
    sendOk(res, req, { query: q, hits });
  }),
);

// GET /public/help/:accountId/a/:slug — a single published article.
router.get(
  '/:accountId/a/:slug',
  asyncHandler(async (req, res) => {
    const accountId = String(req.params.accountId);
    if (badAccount(accountId)) {
      return sendOk(res, req, { article: null });
    }
    const row = await prisma.helpArticle.findFirst({
      where: { accountId, slug: String(req.params.slug), kind: 'article', status: 'published' },
    });
    sendOk(res, req, {
      article: row
        ? {
            id: row.id,
            slug: row.slug,
            category: row.category,
            title: row.title,
            body: row.body,
            updatedAt: row.updatedAt,
          }
        : null,
    });
  }),
);

function emptyBundle() {
  return {
    contact: { email: null, phone: null, address: null, contactUrl: null, docsUrl: null },
    intro: null,
    hideBranding: false,
    faqs: [] as unknown[],
    articles: [] as unknown[],
  };
}

export default router;

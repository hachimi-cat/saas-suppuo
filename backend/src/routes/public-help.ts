import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { sendOk, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { helpSearch } from '../lib/help-search.js';
import { resolveAccountId } from '../lib/resolve-account.js';

/*
 * /api/v1/public/help — the unauthenticated read surface for the hosted
 * help center (suppuo.com/support/<acc>). Serves only PUBLISHED content
 * + the public contact profile + the product deep-links. The accountId
 * (unguessable Huudis id) is the gate — same model as the public ticket
 * form. No PII beyond what the workspace chose to publish.
 */

const router = Router();

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

// GET /public/help/:accountId/branding — public branding (logo + colors +
// name) for the help center AND the hosted portal's pre-auth screen.
router.get(
  '/:accountId/branding',
  asyncHandler(async (req, res) => {
    const accountId = await resolveAccountId(String(req.params.accountId));
    if (!accountId) {
      return sendOk(res, req, emptyBranding());
    }
    const s = await prisma.accountSettings.findUnique({ where: { accountId } });
    sendOk(res, req, brandingView(s));
  }),
);

// GET /public/help/:accountId/logo — serve the uploaded brand logo bytes.
router.get(
  '/:accountId/logo',
  asyncHandler(async (req, res) => {
    const accountId = await resolveAccountId(String(req.params.accountId));
    if (!accountId) return sendErr(res, req, 404, 'NOT_FOUND', 'no logo');
    const s = await prisma.accountSettings.findUnique({
      where: { accountId },
      select: { brandLogoData: true, brandLogoType: true },
    });
    if (!s?.brandLogoData || !s.brandLogoType) {
      return sendErr(res, req, 404, 'NOT_FOUND', 'no logo');
    }
    res.status(200);
    res.setHeader('Content-Type', s.brandLogoType);
    res.setHeader('Content-Length', String(s.brandLogoData.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.end(Buffer.from(s.brandLogoData));
  }),
);

// GET /public/help/:accountId — the help-center bundle.
router.get(
  '/:accountId',
  asyncHandler(async (req, res) => {
    const accountId = await resolveAccountId(String(req.params.accountId));
    if (!accountId) {
      return sendOk(res, req, emptyBundle());
    }
    const [settings, faqs, articles, docs] = await Promise.all([
      prisma.accountSettings.findUnique({ where: { accountId } }),
      prisma.helpArticle.findMany({
        where: { accountId, kind: 'faq', status: 'published' },
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      }),
      prisma.helpArticle.findMany({
        where: { accountId, kind: 'article', status: 'published' },
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      }),
      // Ingested product documentation (kind='doc') — rendered as a
      // separate "Documentation" section; searchable like everything else.
      prisma.helpArticle.findMany({
        where: { accountId, kind: 'doc', status: 'published' },
        orderBy: [{ category: 'asc' }, { position: 'asc' }, { title: 'asc' }],
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
      branding: brandingView(settings),
      faqs: faqs.map(faqView),
      articles: articles.map(articleCardView),
      docs: docs.map(articleCardView),
    });
  }),
);

// GET /public/help/:accountId/search?q= — keyword search over published
// FAQ + articles (Catentio AI swaps in behind helpSearch later).
const searchQuery = z.object({ q: z.string().trim().max(200).default('') });
router.get(
  '/:accountId/search',
  asyncHandler(async (req, res) => {
    const accountId = await resolveAccountId(String(req.params.accountId));
    const { q } = searchQuery.parse(req.query);
    if (!accountId || !q) {
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
    const accountId = await resolveAccountId(String(req.params.accountId));
    if (!accountId) {
      return sendOk(res, req, { article: null });
    }
    const row = await prisma.helpArticle.findFirst({
      where: {
        accountId,
        slug: String(req.params.slug),
        kind: { in: ['article', 'doc'] },
        status: 'published',
      },
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

function brandingView(s: {
  brandName?: string | null;
  brandLogoUrl?: string | null;
  accentColor?: string | null;
  brandColor?: string | null;
  hideBranding?: boolean;
  docsUrl?: string | null;
  contactUrl?: string | null;
} | null) {
  return {
    name: s?.brandName ?? null,
    logoUrl: s?.brandLogoUrl ?? null,
    accentColor: s?.accentColor ?? null,
    brandColor: s?.brandColor ?? null,
    hideBranding: s?.hideBranding ?? false,
    // Product deep-links — the hosted portal surfaces these as nav items.
    docsUrl: s?.docsUrl ?? null,
    contactUrl: s?.contactUrl ?? null,
  };
}

function emptyBranding() {
  return {
    name: null,
    logoUrl: null,
    accentColor: null,
    brandColor: null,
    hideBranding: false,
    docsUrl: null,
    contactUrl: null,
  };
}

function emptyBundle() {
  return {
    contact: { email: null, phone: null, address: null, contactUrl: null, docsUrl: null },
    intro: null,
    hideBranding: false,
    branding: emptyBranding(),
    faqs: [] as unknown[],
    articles: [] as unknown[],
    docs: [] as unknown[],
  };
}

export default router;

import { prisma } from './db.js';

/*
 * Help-center search — behind a provider interface so the Catentio AI
 * can swap in later (semantic answer + "talk to a human" escalation)
 * WITHOUT changing the public route or the schema. v1 is a plain
 * case-insensitive contains match over published FAQ/article title+body,
 * ranked title-first.
 */

export interface HelpSearchHit {
  id: string;
  kind: string;
  slug: string | null;
  category: string | null;
  title: string;
  /** A short snippet around the match (or the lead of the body). */
  excerpt: string;
}

export interface HelpSearchProvider {
  search(accountId: string, query: string, limit?: number): Promise<HelpSearchHit[]>;
}

function excerptOf(body: string, query: string, len = 160): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return flat.slice(0, len) + (flat.length > len ? '…' : '');
  const start = Math.max(0, at - 40);
  const slice = flat.slice(start, start + len);
  return (start > 0 ? '…' : '') + slice + (start + len < flat.length ? '…' : '');
}

/** v1 keyword provider — ILIKE over published items for the account. */
export const keywordSearch: HelpSearchProvider = {
  async search(accountId, query, limit = 10) {
    const q = query.trim();
    if (!q) return [];
    const rows = await prisma.helpArticle.findMany({
      where: {
        accountId,
        status: 'published',
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { body: { contains: q, mode: 'insensitive' } },
        ],
      },
      // Title matches first, then by manual position.
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      take: limit * 2,
    });
    const titleHit = (r: { title: string }) => r.title.toLowerCase().includes(q.toLowerCase());
    return rows
      .sort((a, b) => Number(titleHit(b)) - Number(titleHit(a)))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        slug: r.slug,
        category: r.category,
        title: r.title,
        excerpt: excerptOf(r.body, q),
      }));
  },
};

/** The active provider. Catentio AI replaces this binding later. */
export const helpSearch: HelpSearchProvider = keywordSearch;

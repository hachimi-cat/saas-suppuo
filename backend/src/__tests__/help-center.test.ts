import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/*
 * Help center — portal KB CRUD (account-scoped) + the public read
 * surface (published-only bundle + keyword search). Prisma is mocked
 * with a tiny in-memory help_articles + account_settings store.
 */

const AGENT_ACCOUNT = 'acc_01KPHFWPGDAYH9WG7KYY36KF58';
const OTHER_ACCOUNT = 'acc_01KPHFWPCNT7EE9VEKV2G7AFXE';

interface Row {
  id: string;
  accountId: string;
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

let articles: Row[] = [];
const settings = new Map<string, Record<string, unknown>>();

function matchWhere(r: Row, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') continue; // handled by caller
    if ((r as unknown as Record<string, unknown>)[k] !== v) return false;
  }
  return true;
}

const helpArticle = {
  findMany: async (args: { where: Record<string, unknown> }) => {
    const where = args.where ?? {};
    let rows = articles.filter((r) => matchWhere(r, where));
    if (Array.isArray(where.OR)) {
      rows = rows.filter((r) =>
        (where.OR as Array<Record<string, { contains: string }>>).some((cond) => {
          const entry = Object.entries(cond)[0];
          if (!entry) return false;
          const [field, f] = entry;
          const val = (r as unknown as Record<string, string>)[field];
          return typeof val === 'string' && val.toLowerCase().includes(f.contains.toLowerCase());
        }),
      );
    }
    return rows;
  },
  findFirst: async (args: { where: Record<string, unknown> }) =>
    articles.find((r) => matchWhere(r, args.where)) ?? null,
  create: async (args: { data: Omit<Row, 'createdAt' | 'updatedAt'> }) => {
    if (
      args.data.slug &&
      articles.some((r) => r.accountId === args.data.accountId && r.slug === args.data.slug)
    ) {
      throw Object.assign(new Error('unique'), { code: 'P2002' });
    }
    const row: Row = { ...args.data, createdAt: new Date(), updatedAt: new Date() };
    articles.push(row);
    return row;
  },
  update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
    const row = articles.find((r) => r.id === args.where.id)!;
    Object.assign(row, args.data, { updatedAt: new Date() });
    return row;
  },
  deleteMany: async (args: { where: Record<string, unknown> }) => {
    const before = articles.length;
    articles = articles.filter((r) => !matchWhere(r, args.where));
    return { count: before - articles.length };
  },
};

const accountSettings = {
  findUnique: async (args: { where: { accountId: string } }) =>
    settings.get(args.where.accountId) ?? null,
};

vi.mock('../lib/db.js', () => ({
  prisma: { helpArticle, accountSettings },
}));

// Auth mock — the agent session is always AGENT_ACCOUNT.
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: { auth?: unknown }, _res: unknown, next: () => void) => {
    req.auth = { sub: 'usr_agent', accountId: AGENT_ACCOUNT };
    next();
  },
}));

const { createApp } = await import('../app.js');
const app = createApp();

beforeEach(() => {
  articles = [];
  settings.clear();
});

describe('help KB portal CRUD', () => {
  it('creates, lists, and scopes articles to the workspace', async () => {
    const create = await request(app)
      .post('/api/v1/help/articles')
      .send({ kind: 'faq', title: 'How do I reset my password?', body: 'Use the reset link.', status: 'published' });
    expect(create.status).toBe(201);
    expect(create.body.data.id).toMatch(/^hlp_/);

    // A foreign-account row must never appear in this workspace's list.
    articles.push({
      id: 'hlp_foreign', accountId: OTHER_ACCOUNT, kind: 'faq', slug: null, category: null,
      title: 'secret', body: 'secret', status: 'published', position: 0,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const list = await request(app).get('/api/v1/help/articles');
    expect(list.status).toBe(200);
    expect(list.body.data.articles).toHaveLength(1);
    expect(list.body.data.articles[0].title).toContain('reset my password');
  });

  it('rejects an article kind without a slug (422)', async () => {
    const res = await request(app)
      .post('/api/v1/help/articles')
      .send({ kind: 'article', title: 'Guide', body: 'Long body' });
    expect(res.status).toBe(422);
  });

  it('409s on a duplicate slug', async () => {
    const base = { kind: 'article', slug: 'getting-started', title: 'A', body: 'b' };
    await request(app).post('/api/v1/help/articles').send(base);
    const dup = await request(app).post('/api/v1/help/articles').send(base);
    expect(dup.status).toBe(409);
  });
});

describe('help public read surface', () => {
  beforeEach(() => {
    articles.push(
      {
        id: 'hlp_pub', accountId: AGENT_ACCOUNT, kind: 'faq', slug: null, category: 'Billing',
        title: 'How do refunds work?', body: 'Refunds take 5 days.', status: 'published',
        position: 0, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'hlp_draft', accountId: AGENT_ACCOUNT, kind: 'faq', slug: null, category: null,
        title: 'Draft secret', body: 'unpublished', status: 'draft',
        position: 1, createdAt: new Date(), updatedAt: new Date(),
      },
    );
    settings.set(AGENT_ACCOUNT, {
      accountId: AGENT_ACCOUNT, contactEmail: 'help@suppuo.com', contactPhone: null,
      contactAddress: 'Jakarta', docsUrl: 'https://suppuo.com/docs', contactUrl: null,
      helpIntro: 'How can we help?', hideBranding: false,
    });
  });

  it('serves only published content + the contact profile', async () => {
    const res = await request(app).get(`/api/v1/public/help/${AGENT_ACCOUNT}`);
    expect(res.status).toBe(200);
    expect(res.body.data.faqs).toHaveLength(1); // draft excluded
    expect(res.body.data.faqs[0].question).toContain('refunds');
    expect(res.body.data.contact.email).toBe('help@suppuo.com');
    expect(res.body.data.contact.docsUrl).toBe('https://suppuo.com/docs');
    expect(res.body.data.intro).toBe('How can we help?');
  });

  it('searches published items and excludes drafts', async () => {
    const hit = await request(app).get(`/api/v1/public/help/${AGENT_ACCOUNT}/search?q=refund`);
    expect(hit.status).toBe(200);
    expect(hit.body.data.hits).toHaveLength(1);
    expect(hit.body.data.hits[0].title).toContain('refunds');

    const draftSearch = await request(app).get(`/api/v1/public/help/${AGENT_ACCOUNT}/search?q=secret`);
    expect(draftSearch.body.data.hits).toHaveLength(0); // draft never surfaces
  });

  it('returns an empty bundle for a malformed account id (no 500)', async () => {
    const res = await request(app).get('/api/v1/public/help/not-an-account');
    expect(res.status).toBe(200);
    expect(res.body.data.faqs).toHaveLength(0);
  });
});

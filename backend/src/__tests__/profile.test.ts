import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/*
 * Agent profile avatars — route tests with prisma + auth mocked.
 * Covers: type/size rejection, upsert (create then replace), the
 * self-only write invariant (PUT always writes the CALLER's sub),
 * idempotent delete, any-member GET + 404 when none.
 */

interface ProfileRow {
  sub: string;
  avatar: Uint8Array;
  contentType: string;
  updatedAt: Date;
}

const profiles: ProfileRow[] = [];

const CALLER_SUB = 'usr_agent_1';
const OTHER_SUB = 'usr_agent_2';
const AGENT_ACCOUNT = 'acc_agent_workspace_1';

function pick(row: ProfileRow, select?: Record<string, boolean>) {
  if (!select) return row;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(select)) out[k] = row[k as keyof ProfileRow];
  return out;
}

const prismaMock = {
  agentProfile: {
    upsert: async (args: {
      where: { sub: string };
      create: { sub: string; avatar: Buffer; contentType: string };
      update: { avatar: Buffer; contentType: string };
      select?: Record<string, boolean>;
    }) => {
      let row = profiles.find((p) => p.sub === args.where.sub);
      if (row) {
        row.avatar = args.update.avatar;
        row.contentType = args.update.contentType;
        row.updatedAt = new Date();
      } else {
        row = { ...args.create, updatedAt: new Date() };
        profiles.push(row);
      }
      return pick(row, args.select);
    },
    deleteMany: async (args: { where: { sub: string } }) => {
      const before = profiles.length;
      for (let i = profiles.length - 1; i >= 0; i--) {
        if (profiles[i]!.sub === args.where.sub) profiles.splice(i, 1);
      }
      return { count: before - profiles.length };
    },
    findUnique: async (args: { where: { sub: string } }) =>
      profiles.find((p) => p.sub === args.where.sub) ?? null,
  },
};

vi.mock('../lib/db.js', () => ({ prisma: prismaMock }));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: { auth?: unknown }, _res: unknown, next: () => void) => {
    req.auth = { sub: CALLER_SUB, accountId: AGENT_ACCOUNT };
    next();
  },
}));

const { createApp } = await import('../app.js');
const { MAX_AVATAR_BYTES } = await import('../routes/profile.js');

beforeEach(() => {
  profiles.length = 0;
});

async function put(app: ReturnType<typeof createApp>, opts?: { type?: string; body?: Buffer }) {
  return request(app)
    .put('/api/v1/profile/avatar')
    .set('Content-Type', opts?.type ?? 'image/png')
    .send(opts?.body ?? Buffer.from('fake-png-bytes'));
}

describe('PUT /api/v1/profile/avatar', () => {
  it('upserts the caller avatar and returns metadata without bytes', async () => {
    const res = await put(createApp());
    expect(res.status).toBe(200);
    expect(res.body.data.sub).toBe(CALLER_SUB);
    expect(res.body.data.contentType).toBe('image/png');
    expect(res.body.data.updatedAt).toBeTruthy();
    expect(res.body.data.avatar).toBeUndefined();
    expect(profiles).toHaveLength(1);
    expect(Buffer.from(profiles[0]!.avatar).toString()).toBe('fake-png-bytes');
  });

  it('replaces an existing avatar on re-upload (upsert, still one row)', async () => {
    const app = createApp();
    await put(app);
    const res = await put(app, { type: 'image/webp', body: Buffer.from('webp-bytes') });
    expect(res.status).toBe(200);
    expect(res.body.data.contentType).toBe('image/webp');
    expect(profiles).toHaveLength(1);
    expect(Buffer.from(profiles[0]!.avatar).toString()).toBe('webp-bytes');
  });

  it('always writes the CALLER sub — there is no sub param on write', async () => {
    // Even with a foreign row present, an upload only touches the
    // caller's own row.
    profiles.push({
      sub: OTHER_SUB,
      avatar: Buffer.from('theirs'),
      contentType: 'image/png',
      updatedAt: new Date(),
    });
    const res = await put(createApp());
    expect(res.status).toBe(200);
    expect(res.body.data.sub).toBe(CALLER_SUB);
    expect(Buffer.from(profiles.find((p) => p.sub === OTHER_SUB)!.avatar).toString()).toBe('theirs');
  });

  it('rejects disallowed content types', async () => {
    for (const type of ['image/gif', 'application/pdf', 'text/html']) {
      const res = await put(createApp(), { type });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(profiles).toHaveLength(0);
  });

  it('rejects empty bodies', async () => {
    const res = await request(createApp())
      .put('/api/v1/profile/avatar')
      .set('Content-Type', 'image/png')
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/empty/);
  });

  it('rejects files over the 1MB cap', async () => {
    const res = await put(createApp(), { body: Buffer.alloc(MAX_AVATAR_BYTES + 1, 1) });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/1MB/);
    expect(profiles).toHaveLength(0);
  });
});

describe('DELETE /api/v1/profile/avatar', () => {
  it('removes own avatar', async () => {
    const app = createApp();
    await put(app);
    const res = await request(app).delete('/api/v1/profile/avatar');
    expect(res.status).toBe(200);
    expect(profiles).toHaveLength(0);
  });

  it('is idempotent — deleting a non-existent avatar succeeds', async () => {
    const res = await request(createApp()).delete('/api/v1/profile/avatar');
    expect(res.status).toBe(200);
  });

  it('only removes the caller row', async () => {
    profiles.push({
      sub: OTHER_SUB,
      avatar: Buffer.from('theirs'),
      contentType: 'image/png',
      updatedAt: new Date(),
    });
    await request(createApp()).delete('/api/v1/profile/avatar');
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.sub).toBe(OTHER_SUB);
  });
});

describe('GET /api/v1/profile/avatar/:sub', () => {
  it('serves any member avatar with content + cache headers', async () => {
    profiles.push({
      sub: OTHER_SUB,
      avatar: Buffer.from('their-jpeg'),
      contentType: 'image/jpeg',
      updatedAt: new Date(),
    });
    const res = await request(createApp()).get(`/api/v1/profile/avatar/${OTHER_SUB}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(res.headers['cache-control']).toBe('private, max-age=300');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body.toString()).toBe('their-jpeg');
  });

  it('404s when the sub has no avatar', async () => {
    const res = await request(createApp()).get('/api/v1/profile/avatar/usr_nobody');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

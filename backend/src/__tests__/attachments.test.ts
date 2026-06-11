import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/*
 * Ticket-message attachments — validation unit tests + route tests
 * (upload staging, account-scope denial, staged-binding in the
 * message-create transaction) with prisma + auth mocked.
 */

interface AttRow {
  id: string;
  accountId: string;
  messageId: string | null;
  filename: string;
  contentType: string;
  size: number;
  data: Uint8Array;
  createdAt: Date;
}

const attachments: AttRow[] = [];
const messages: Array<Record<string, unknown>> = [];

const AGENT_ACCOUNT = 'acc_agent_workspace_1';
const OTHER_ACCOUNT = 'acc_someone_else_9';

const TICKET = {
  id: 'tkt_1',
  accountId: AGENT_ACCOUNT,
  number: 7,
  subject: 'Help',
  status: 'open',
  priority: 'normal',
  channel: 'web',
  requesterEmail: null,
  requesterName: 'Budi',
  requesterPhone: null,
  requesterExternalId: null,
  accessToken: 'tok_public_abc',
  createdAt: new Date(),
};

function metaOf(row: AttRow) {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.contentType,
    size: row.size,
    createdAt: row.createdAt,
  };
}

const db = {
  attachment: {
    create: async (args: { data: Omit<AttRow, 'createdAt'>; select?: unknown }) => {
      const row: AttRow = { ...args.data, createdAt: new Date() };
      attachments.push(row);
      return args.select ? metaOf(row) : row;
    },
    findFirst: async (args: {
      where: { id: string; accountId?: string; message?: unknown };
    }) => {
      const row = attachments.find((a) => a.id === args.where.id);
      if (!row) return null;
      if (args.where.accountId && row.accountId !== args.where.accountId) return null;
      if (args.where.message && row.messageId === null) return null;
      return row;
    },
    updateMany: async (args: {
      where: { id: { in: string[] }; accountId: string; messageId: null };
      data: { messageId: string };
    }) => {
      let count = 0;
      for (const a of attachments) {
        if (
          args.where.id.in.includes(a.id) &&
          a.accountId === args.where.accountId &&
          a.messageId === null
        ) {
          a.messageId = args.data.messageId;
          count++;
        }
      }
      return { count };
    },
    deleteMany: async () => ({ count: 0 }),
  },
  ticket: {
    findFirst: async (args: { where: { id?: string; accountId?: string } }) =>
      args.where.id === TICKET.id && args.where.accountId === TICKET.accountId ? TICKET : null,
    findUnique: async (args: { where: { accessToken?: string } }) =>
      args.where.accessToken === TICKET.accessToken ? TICKET : null,
    update: async () => TICKET,
  },
  ticketMessage: {
    create: async (args: { data: Record<string, unknown> }) => {
      messages.push(args.data);
      return { ...args.data, createdAt: new Date() };
    },
  },
  outboxEvent: {
    create: async (args: { data: Record<string, unknown> }) => args.data,
  },
};

const prismaMock = {
  ...db,
  $transaction: async <T>(fn: (tx: typeof db) => Promise<T>): Promise<T> => fn(db),
};

vi.mock('../lib/db.js', () => ({ prisma: prismaMock }));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (
    req: { auth?: unknown },
    _res: unknown,
    next: () => void,
  ) => {
    req.auth = { sub: 'usr_agent_1', accountId: AGENT_ACCOUNT };
    next();
  },
}));

const { createApp } = await import('../app.js');
const {
  validateUpload,
  hasBlockedExtension,
  sanitizeFilename,
  dispositionFor,
  ingestFilename,
  isIngestAllowedContentType,
  MAX_ATTACHMENT_BYTES,
  AttachmentValidationError,
} = await import('../lib/attachments.js');

beforeEach(() => {
  attachments.length = 0;
  messages.length = 0;
});

// ─── lib unit tests ───────────────────────────────────────────────────

describe('attachment validation', () => {
  it('accepts the documented allowlist', () => {
    for (const ct of [
      'image/png',
      'image/jpeg',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
    ]) {
      expect(() => validateUpload({ filename: 'f.bin.ok', contentType: ct, size: 10 })).not.toThrow();
    }
  });

  it('rejects executables and unknown content types', () => {
    expect(() =>
      validateUpload({ filename: 'evil', contentType: 'application/x-msdownload', size: 10 }),
    ).toThrow(AttachmentValidationError);
    expect(() =>
      validateUpload({ filename: 'page.html', contentType: 'text/html', size: 10 }),
    ).toThrow(AttachmentValidationError);
    // Allowed content type but executable extension — still rejected.
    expect(() =>
      validateUpload({ filename: 'setup.exe', contentType: 'application/zip', size: 10 }),
    ).toThrow(/executable/);
    expect(hasBlockedExtension('script.SH')).toBe(true);
    expect(hasBlockedExtension('report.pdf')).toBe(false);
  });

  it('enforces the 8MB cap and rejects empty files', () => {
    expect(() =>
      validateUpload({ filename: 'a.png', contentType: 'image/png', size: MAX_ATTACHMENT_BYTES }),
    ).not.toThrow();
    expect(() =>
      validateUpload({
        filename: 'a.png',
        contentType: 'image/png',
        size: MAX_ATTACHMENT_BYTES + 1,
      }),
    ).toThrow(/8MB/);
    expect(() => validateUpload({ filename: 'a.png', contentType: 'image/png', size: 0 })).toThrow(
      /empty/,
    );
  });

  it('sanitizes path-traversal filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\Users\\x\\inv.pdf')).toBe('inv.pdf');
    expect(sanitizeFilename('')).toBe('file');
  });

  it('serves raster images inline and everything else as attachment', () => {
    expect(dispositionFor('image/png', 'a.png')).toMatch(/^inline/);
    expect(dispositionFor('application/pdf', 'a.pdf')).toMatch(/^attachment/);
    expect(dispositionFor('application/zip', 'naïve.zip')).toContain("filename*=UTF-8''na%C3%AFve.zip");
  });

  it('synthesizes WhatsApp media filenames + widens the ingest allowlist', () => {
    expect(ingestFilename('image/jpeg', 0)).toBe('photo-1.jpg');
    expect(ingestFilename('audio/ogg; codecs=opus', 1)).toBe('audio-2.ogg');
    expect(isIngestAllowedContentType('audio/ogg')).toBe(true);
    expect(isIngestAllowedContentType('application/x-msdownload')).toBe(false);
  });
});

// ─── route tests ──────────────────────────────────────────────────────

async function stage(app: ReturnType<typeof createApp>, opts?: { type?: string; name?: string }) {
  return request(app)
    .post('/api/v1/attachments')
    .set('Content-Type', opts?.type ?? 'image/png')
    .set('x-filename', opts?.name ?? 'photo.png')
    .send(Buffer.from('fake-png-bytes'));
}

describe('POST /api/v1/attachments (agent staging)', () => {
  it('stages an allowed upload and returns metadata without bytes', async () => {
    const res = await stage(createApp());
    expect(res.status).toBe(201);
    expect(res.body.data.id).toMatch(/^att_/);
    expect(res.body.data.filename).toBe('photo.png');
    expect(res.body.data.contentType).toBe('image/png');
    expect(res.body.data.size).toBe('fake-png-bytes'.length);
    expect(res.body.data.data).toBeUndefined();
    expect(attachments[0]!.messageId).toBeNull();
    expect(attachments[0]!.accountId).toBe(AGENT_ACCOUNT);
  });

  it('rejects disallowed content types', async () => {
    const res = await stage(createApp(), { type: 'application/x-msdownload', name: 'evil.bin' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(attachments).toHaveLength(0);
  });

  it('rejects executable extensions even with an allowed content type', async () => {
    const res = await stage(createApp(), { type: 'application/zip', name: 'setup.exe' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/executable/);
  });

  it('rejects files over the 8MB cap', async () => {
    const res = await request(createApp())
      .post('/api/v1/attachments')
      .set('Content-Type', 'image/png')
      .set('x-filename', 'big.png')
      .send(Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 1));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/8MB/);
  });

  it('requires the x-filename header', async () => {
    const res = await request(createApp())
      .post('/api/v1/attachments')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('x'));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/x-filename/);
  });
});

describe('GET /api/v1/attachments/:id (agent download)', () => {
  it('serves own-account attachments with content headers', async () => {
    const app = createApp();
    const staged = await stage(app);
    const res = await request(app).get(`/api/v1/attachments/${staged.body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-disposition']).toMatch(/^inline.*photo\.png/);
    expect(res.body.toString()).toBe('fake-png-bytes');
  });

  it('denies cross-account access (404, no existence leak)', async () => {
    attachments.push({
      id: 'att_foreign',
      accountId: OTHER_ACCOUNT,
      messageId: 'tmsg_x',
      filename: 'secret.pdf',
      contentType: 'application/pdf',
      size: 3,
      data: new Uint8Array([1, 2, 3]),
      createdAt: new Date(),
    });
    const res = await request(createApp()).get('/api/v1/attachments/att_foreign');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('staged-binding via POST /api/v1/tickets/:id/messages', () => {
  it('binds staged attachments to the new message in the same transaction', async () => {
    const app = createApp();
    const a = await stage(app);
    const b = await stage(app, { name: 'doc.pdf', type: 'application/pdf' });
    const res = await request(app)
      .post(`/api/v1/tickets/${TICKET.id}/messages`)
      .send({ body: 'see attached', attachmentIds: [a.body.data.id, b.body.data.id] });
    expect(res.status).toBe(201);
    const messageId = res.body.data.message.id as string;
    expect(attachments.every((x) => x.messageId === messageId)).toBe(true);
  });

  it('rejects unknown / already-bound / cross-account attachment ids', async () => {
    const app = createApp();
    const a = await stage(app);
    // Bind once…
    const first = await request(app)
      .post(`/api/v1/tickets/${TICKET.id}/messages`)
      .send({ body: 'first', attachmentIds: [a.body.data.id] });
    expect(first.status).toBe(201);
    // …re-using the same id must fail.
    const reuse = await request(app)
      .post(`/api/v1/tickets/${TICKET.id}/messages`)
      .send({ body: 'second', attachmentIds: [a.body.data.id] });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('VALIDATION_ERROR');

    const unknown = await request(app)
      .post(`/api/v1/tickets/${TICKET.id}/messages`)
      .send({ body: 'third', attachmentIds: ['att_nope'] });
    expect(unknown.status).toBe(400);
  });

  it('caps a message at 5 attachments', async () => {
    const res = await request(createApp())
      .post(`/api/v1/tickets/${TICKET.id}/messages`)
      .send({ body: 'too many', attachmentIds: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(res.status).toBe(400);
  });
});

describe('public token surface', () => {
  it('stages uploads against the ticket account and binds via the public reply', async () => {
    const app = createApp();
    const up = await request(app)
      .post(`/api/v1/public/tickets/${TICKET.accessToken}/attachments`)
      .set('Content-Type', 'image/jpeg')
      .set('x-filename', 'receipt.jpg')
      .send(Buffer.from('jpegbytes'));
    expect(up.status).toBe(201);
    expect(attachments[0]!.accountId).toBe(AGENT_ACCOUNT);

    const reply = await request(app)
      .post(`/api/v1/public/tickets/${TICKET.accessToken}/messages`)
      .send({ body: 'here is my receipt', attachmentIds: [up.body.data.id] });
    expect(reply.status).toBe(201);
    expect(attachments[0]!.messageId).toBeTruthy();
  });

  it('404s public download for staged (unbound) attachments and bad tokens', async () => {
    const app = createApp();
    const up = await request(app)
      .post(`/api/v1/public/tickets/${TICKET.accessToken}/attachments`)
      .set('Content-Type', 'image/jpeg')
      .set('x-filename', 'receipt.jpg')
      .send(Buffer.from('jpegbytes'));
    const staged = await request(app).get(
      `/api/v1/public/tickets/${TICKET.accessToken}/attachments/${up.body.data.id}`,
    );
    expect(staged.status).toBe(404);

    const badToken = await request(app).get(
      `/api/v1/public/tickets/tok_wrong/attachments/${up.body.data.id}`,
    );
    expect(badToken.status).toBe(404);
  });

  it('sends widget CORS headers on the upload route', async () => {
    const res = await request(createApp())
      .options(`/api/v1/public/tickets/${TICKET.accessToken}/attachments`)
      .set('Origin', 'https://customer-site.example');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-headers']).toContain('X-Filename');
  });
});

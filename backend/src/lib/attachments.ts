import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { newId } from './ids.js';

/*
 * Ticket-message attachments — shared validation + staging/binding.
 *
 * v1 stores the bytes inline in Postgres (Attachment.data Bytes) —
 * SME volume is small, and this avoids new infra + the rsync-deploy
 * data-wipe class of risk.
 * // TODO: DO Spaces when volume demands
 *
 * Lifecycle: upload endpoints create STAGED rows (messageId = null,
 * scoped to an accountId); the message-create transaction binds them
 * (sets messageId) — bind validates account scope + staged state.
 * Staged rows older than STAGED_TTL_MS are swept by the outbox worker
 * tick.
 */

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB per file
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const STAGED_TTL_MS = 60 * 60 * 1000; // 1h

/** Content-type allowlist: images, pdf, plain text, csv, docx/xlsx,
 *  zip. Executables and everything else are rejected. */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/zip',
  'application/x-zip-compressed',
]);

/** Extension blacklist — defense in depth against executables sent
 *  with a spoofed (allowed) content-type. */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'dll', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'sh', 'bash',
  'js', 'mjs', 'cjs', 'vbs', 'jar', 'apk', 'app', 'deb', 'rpm', 'php',
]);

/** Raster image types we serve inline (preview-safe — no script
 *  execution risk, unlike e.g. SVG or HTML). */
const INLINE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/** Channel-ingested media (WhatsApp voice notes, videos) gets a wider
 *  net than direct uploads — these bytes come from the provider's CDN,
 *  not an arbitrary browser, and dropping them silently is the exact
 *  bug this feature fixes. */
const INGEST_EXTRA_TYPES = new Set([
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/amr',
  'video/mp4',
  'video/3gpp',
]);

export function isIngestAllowedContentType(contentType: string): boolean {
  const ct = contentType.split(';')[0]!.trim().toLowerCase();
  return ALLOWED_CONTENT_TYPES.has(ct) || INGEST_EXTRA_TYPES.has(ct);
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/amr': 'amr',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
};

/** Synthesize a filename for channel media that arrives nameless. */
export function ingestFilename(contentType: string, index: number): string {
  const ct = contentType.split(';')[0]!.trim().toLowerCase();
  const kind = ct.startsWith('image/')
    ? 'photo'
    : ct.startsWith('audio/')
      ? 'audio'
      : ct.startsWith('video/')
        ? 'video'
        : 'document';
  return `${kind}-${index + 1}.${EXTENSION_BY_TYPE[ct] ?? 'bin'}`;
}

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType.split(';')[0]!.trim().toLowerCase());
}

export function hasBlockedExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return BLOCKED_EXTENSIONS.has(ext);
}

/** Strip path components + control chars; never trust the client. */
export function sanitizeFilename(raw: string): string {
  const base = raw.replace(/[/\\]/g, '/').split('/').pop() ?? 'file';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\x00-\x1f\x7f"]/g, '').trim();
  return (clean || 'file').slice(0, 200);
}

/** Whether to serve inline (image previews) vs. attachment download. */
export function dispositionFor(contentType: string, filename: string): string {
  const type = INLINE_IMAGE_TYPES.has(contentType.split(';')[0]!.trim().toLowerCase())
    ? 'inline'
    : 'attachment';
  // RFC 5987 filename* covers non-ASCII; the plain filename is an
  // ASCII-safe fallback.
  const ascii = filename.replace(/[^ -~]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Display-safe metadata — NEVER select `data` into list payloads. */
export const ATTACHMENT_META_SELECT = {
  id: true,
  filename: true,
  contentType: true,
  size: true,
  createdAt: true,
} as const;

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttachmentValidationError';
  }
}

/** Validate an upload; throws AttachmentValidationError on rejection. */
export function validateUpload(opts: {
  filename: string;
  contentType: string;
  size: number;
}): void {
  if (opts.size <= 0) {
    throw new AttachmentValidationError('empty file');
  }
  if (opts.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentValidationError(
      `file exceeds the ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB limit`,
    );
  }
  if (!isAllowedContentType(opts.contentType)) {
    throw new AttachmentValidationError(
      `content type ${opts.contentType} is not allowed (images, pdf, txt, csv, docx, xlsx, zip)`,
    );
  }
  if (hasBlockedExtension(opts.filename)) {
    throw new AttachmentValidationError('executable file types are not allowed');
  }
}

/** Create a STAGED attachment row (messageId = null). */
export async function createStagedAttachment(opts: {
  accountId: string;
  filename: string;
  contentType: string;
  data: Buffer;
}) {
  validateUpload({
    filename: opts.filename,
    contentType: opts.contentType,
    size: opts.data.length,
  });
  return prisma.attachment.create({
    data: {
      id: newId('att'),
      accountId: opts.accountId,
      messageId: null,
      filename: sanitizeFilename(opts.filename),
      contentType: opts.contentType.split(';')[0]!.trim().toLowerCase(),
      size: opts.data.length,
      data: new Uint8Array(opts.data),
    },
    select: ATTACHMENT_META_SELECT,
  });
}

/**
 * Bind staged attachments to a freshly created message, inside the
 * SAME transaction as the message create. Validates that every id is
 * a staged (messageId = null) row in the caller's account — anything
 * else (cross-account id, already-bound id, unknown id) throws.
 */
export async function bindAttachments(
  tx: Prisma.TransactionClient,
  opts: { accountId: string; messageId: string; attachmentIds: string[] },
): Promise<void> {
  const ids = [...new Set(opts.attachmentIds)];
  if (ids.length === 0) return;
  if (ids.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new AttachmentValidationError(
      `at most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`,
    );
  }
  const { count } = await tx.attachment.updateMany({
    where: { id: { in: ids }, accountId: opts.accountId, messageId: null },
    data: { messageId: opts.messageId },
  });
  if (count !== ids.length) {
    throw new AttachmentValidationError('one or more attachment ids are invalid or already used');
  }
}

/** Delete staged rows older than the TTL. Called from the outbox
 *  worker tick (every few minutes) — abandoned uploads don't pile up. */
export async function sweepStagedAttachments(): Promise<number> {
  const { count } = await prisma.attachment.deleteMany({
    where: { messageId: null, createdAt: { lt: new Date(Date.now() - STAGED_TTL_MS) } },
  });
  if (count > 0) console.log(`[attachments] swept ${count} staged upload(s)`);
  return count;
}

'use client';

/*
 * Attachment UI shared by the agent ticket thread and the public
 * status page: a paperclip composer (staged uploads as removable
 * chips) + thread rendering (inline previews for images, filename +
 * size chips for everything else). The download URL builder is passed
 * in because the two surfaces use different endpoints (account-scoped
 * vs. token-scoped).
 */

import { useRef, useState } from 'react';
import { ApiRequestError } from '@/lib/api';

export interface AttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export const MAX_FILES_PER_MESSAGE = 5;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(contentType);
}

/** Render a message's attachments: images inline, others as chips. */
export function MessageAttachments({
  attachments,
  urlFor,
}: {
  attachments: AttachmentMeta[] | undefined;
  urlFor: (id: string) => string;
}) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) =>
        isImage(a.contentType) ? (
          <a key={a.id} href={urlFor(a.id)} target="_blank" rel="noopener noreferrer" title={a.filename}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlFor(a.id)}
              alt={a.filename}
              className="max-h-40 max-w-[240px] rounded-lg border border-border object-cover"
            />
          </a>
        ) : (
          <a
            key={a.id}
            href={urlFor(a.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs hover:border-primary/50"
          >
            <PaperclipIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-[180px] truncate font-medium">{a.filename}</span>
            <span className="text-muted-foreground">{formatSize(a.size)}</span>
          </a>
        ),
      )}
    </div>
  );
}

/**
 * Paperclip button + hidden file input + pending chips. `upload` does
 * the actual staging call (surface-specific endpoint) and returns the
 * staged metadata; the parent owns the pending list so it can send the
 * ids with the message.
 */
export function AttachmentComposer({
  pending,
  onChange,
  upload,
  disabled,
}: {
  pending: AttachmentMeta[];
  onChange: (next: AttachmentMeta[]) => void;
  upload: (file: File) => Promise<AttachmentMeta>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    let next = pending;
    try {
      for (const file of Array.from(files)) {
        if (next.length >= MAX_FILES_PER_MESSAGE) {
          setError(`At most ${MAX_FILES_PER_MESSAGE} files per message.`);
          break;
        }
        const meta = await upload(file);
        next = [...next, meta];
        onChange(next);
      }
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.csv,.docx,.xlsx,.zip"
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || busy || pending.length >= MAX_FILES_PER_MESSAGE}
          onClick={() => inputRef.current?.click()}
          title="Attach files (8MB max each)"
          aria-label="Attach files"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-50"
        >
          <PaperclipIcon className="h-3.5 w-3.5" />
          {busy ? 'Uploading…' : 'Attach'}
        </button>
        {pending.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs"
          >
            <span className="max-w-[160px] truncate font-medium">{a.filename}</span>
            <span className="text-muted-foreground">{formatSize(a.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${a.filename}`}
              onClick={() => onChange(pending.filter((p) => p.id !== a.id))}
              className="text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

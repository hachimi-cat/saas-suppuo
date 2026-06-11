'use client';

/*
 * Workspace settings — the shareable hosted-form URL + canned replies.
 * The accountId comes from /api/v1/auth/me (the BFF session).
 */

import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';

interface CannedReply {
  id: string;
  title: string;
  body: string;
}

export default function SettingsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [canned, setCanned] = useState<CannedReply[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiRequest<{ user?: { id?: string } }>('/auth/me')
      .then(({ data }) => setAccountId(data.user?.id ?? null))
      .catch(() => setAccountId(null));
    loadCanned();
  }, []);

  function loadCanned() {
    apiRequest<{ cannedReplies: CannedReply[] }>('/canned-replies')
      .then(({ data }) => setCanned(data.cannedReplies))
      .catch(() => undefined);
  }

  const formUrl = accountId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/support/${accountId}`
    : null;

  async function addCanned(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/canned-replies', { method: 'POST', body: { title, body } });
      setTitle('');
      setBody('');
      loadCanned();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save');
    }
  }

  async function removeCanned(id: string) {
    await apiRequest(`/canned-replies/${id}`, { method: 'DELETE' }).catch(() => undefined);
    loadCanned();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your support form
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share this link (bio, website footer, WhatsApp auto-reply) — submissions become tickets
          in your inbox.
        </p>
        {formUrl ? (
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              {formUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(formUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        )}
      </section>

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Canned replies
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved snippets you can insert into any reply.
        </p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-3 space-y-2">
          {canned.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.title}</p>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{c.body}</p>
              </div>
              <button onClick={() => removeCanned(c.id)} className="shrink-0 text-xs text-destructive hover:underline">
                Delete
              </button>
            </div>
          ))}
          {canned.length === 0 && (
            <p className="text-sm text-muted-foreground">None yet.</p>
          )}
        </div>
        <form onSubmit={addCanned} className="mt-4 space-y-2">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Refund policy)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply text…" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Add canned reply
          </button>
        </form>
      </section>
    </div>
  );
}

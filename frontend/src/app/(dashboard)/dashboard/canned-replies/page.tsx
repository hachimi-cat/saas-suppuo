'use client';

/*
 * Canned replies — saved reply snippets, per workspace. Moved out of
 * Settings into its own Support-section page. CRUD against
 * /api/v1/canned-replies.
 */

import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';

interface CannedReply {
  id: string;
  title: string;
  body: string;
  /** Not in the API yet — rendered if a future version adds one. */
  shortcut?: string | null;
}

export default function CannedRepliesPage() {
  const [canned, setCanned] = useState<CannedReply[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCanned();
  }, []);

  function loadCanned() {
    apiRequest<{ cannedReplies: CannedReply[] }>('/canned-replies')
      .then(({ data }) => setCanned(data.cannedReplies))
      .catch(() => undefined);
  }

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
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Canned replies"
        description="Saved snippets for the answers you type all the time. Use them from the reply box on any ticket."
      />

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your replies
        </h2>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-3 space-y-2">
          {canned.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {c.title}
                  {c.shortcut && (
                    <code className="ml-2 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      /{c.shortcut}
                    </code>
                  )}
                </p>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{c.body}</p>
              </div>
              <button onClick={() => removeCanned(c.id)} className="shrink-0 text-xs text-destructive hover:underline">
                Delete
              </button>
            </div>
          ))}
          {canned.length === 0 && (
            <p className="text-sm text-muted-foreground">
              None yet — add your first below. Refund policy, shipping times, and password
              resets are the usual suspects.
            </p>
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

'use client';

/*
 * Ticket thread — conversation + reply box (public reply or internal
 * note), status/priority controls, canned-reply picker.
 */

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiRequestError } from '@/lib/api';

interface Message {
  id: string;
  authorType: 'agent' | 'requester';
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requesterName: string | null;
  createdAt: string;
  messages: Message[];
}

interface CannedReply {
  id: string;
  title: string;
  body: string;
}

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [canned, setCanned] = useState<CannedReply[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiRequest<Ticket>(`/tickets/${id}`);
      setTicket(data);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not load ticket');
    }
  }, [id]);

  useEffect(() => {
    load();
    apiRequest<{ cannedReplies: CannedReply[] }>('/canned-replies')
      .then(({ data }) => setCanned(data.cannedReplies))
      .catch(() => undefined);
  }, [load]);

  async function setField(field: 'status' | 'priority', value: string) {
    if (!ticket) return;
    try {
      await apiRequest(`/tickets/${ticket.id}`, { method: 'PATCH', body: { [field]: value } });
      load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Update failed');
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/tickets/${ticket.id}/messages`, {
        method: 'POST',
        body: { body: reply, isInternal: internal },
      });
      setReply('');
      setInternal(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Reply failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !ticket) {
    return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  }
  if (!ticket) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/inbox" className="text-sm text-muted-foreground hover:text-foreground">
        ← Inbox
      </Link>

      <header className="mt-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="mr-2 font-mono text-base text-muted-foreground">#{ticket.number}</span>
            {ticket.subject}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {ticket.requesterName ?? ticket.requesterEmail ?? ticket.requesterPhone} ({ticket.requesterEmail ?? ticket.requesterPhone}) · via{' '}
          {ticket.channel} · {new Date(ticket.createdAt).toLocaleString('en-GB')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Status
            <select
              value={ticket.status}
              onChange={(e) => setField('status', e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium capitalize"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Priority
            <select
              value={ticket.priority}
              onChange={(e) => setField('priority', e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium capitalize"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.isInternal
                ? 'border-amber-500/40 bg-amber-500/5'
                : m.authorType === 'agent'
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card'
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">
                {m.authorType === 'agent' ? (m.authorName ?? 'You (agent)') : (m.authorName ?? 'Customer')}
                {m.isInternal && <span className="ml-2 text-amber-600">internal note</span>}
              </span>
              <span>{new Date(m.createdAt).toLocaleString('en-GB')}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={sendReply} className="mt-5 space-y-2 rounded-xl border border-border p-4">
        {canned.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const c = canned.find((x) => x.id === e.target.value);
              if (c) setReply((r) => (r ? `${r}\n\n${c.body}` : c.body));
            }}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="">Insert canned reply…</option>
            {canned.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={internal ? 'Internal note — the customer never sees this' : 'Reply to the customer (sent by email)'}
          rows={4}
          className={`w-full rounded-lg border bg-background px-3 py-2 text-sm ${internal ? 'border-amber-500/50' : 'border-border'}`}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            Internal note
          </label>
          <button
            disabled={busy || !reply.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Sending…' : internal ? 'Add note' : 'Send reply'}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

/*
 * Agent inbox — the Suppuo home surface. Status tabs + ticket list,
 * live from /api/v1/tickets (BFF session cookie). New-ticket dialog
 * logs out-of-band inquiries (WhatsApp/phone) as tickets.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiRequestError } from '@/lib/api';

interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  requesterEmail: string;
  requesterName: string | null;
  lastMessageAt: string;
  createdAt: string;
}

const STATUS_TABS = ['all', 'open', 'pending', 'resolved', 'closed'] as const;

const STATUS_TONES: Record<string, string> = {
  open: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  resolved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_TONES: Record<string, string> = {
  urgent: 'text-rose-500',
  high: 'text-amber-500',
  normal: 'text-muted-foreground',
  low: 'text-muted-foreground/60',
};

function rel(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function InboxPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>('all');
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async (status: string) => {
    setError(null);
    try {
      const { data } = await apiRequest<{ tickets: Ticket[]; counts: Record<string, number> }>(
        `/tickets?status=${status}`,
      );
      setTickets(data.tickets);
      setCounts(data.counts);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not load tickets');
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every customer request, in one place.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          New ticket
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              tab === s
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {s}
            {s === 'all' ? (total > 0 ? ` (${total})` : '') : counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {tickets === null ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {tab === 'all'
            ? 'No tickets yet. Share your support form (Settings) or log one with “New ticket”.'
            : `No ${tab} tickets.`}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/tickets/${t.id}`}
              className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40"
            >
              <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                #{t.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.subject}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t.requesterName ?? t.requesterEmail} · {t.channel}
                </span>
              </span>
              <span className={`hidden text-xs font-medium capitalize sm:block ${PRIORITY_TONES[t.priority] ?? ''}`}>
                {t.priority !== 'normal' ? t.priority : ''}
              </span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONES[t.status] ?? ''}`}
              >
                {t.status}
              </span>
              <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                {rel(t.lastMessageAt)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <NewTicketDialog
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load(tab);
          }}
        />
      )}
    </div>
  );
}

function NewTicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'web' | 'email'>('whatsapp');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/tickets', {
        method: 'POST',
        body: { subject, requesterEmail: email, requesterName: name || undefined, body, channel },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create ticket');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl border border-border bg-background p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold">Log a ticket</h2>
        <p className="text-xs text-muted-foreground">
          For requests that arrived outside the form — WhatsApp, phone, DM. The customer gets the
          status link by email.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Customer email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do they need?" rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={channel} onChange={(e) => setChannel(e.target.value as never)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="whatsapp">Came in via WhatsApp</option>
          <option value="email">Came in via email</option>
          <option value="web">Other / walk-in</option>
        </select>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}

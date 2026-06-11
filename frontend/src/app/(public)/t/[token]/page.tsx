'use client';

/*
 * Tokenized ticket status page (/t/<token>) — the requester's view:
 * public thread + reply box. The token from their email IS the auth.
 */

import { use, useCallback, useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';

interface PublicMessage {
  id: string;
  authorType: 'agent' | 'requester';
  authorName: string | null;
  body: string;
  createdAt: string;
}

interface PublicTicket {
  number: number;
  subject: string;
  status: string;
  createdAt: string;
  messages: PublicMessage[];
  /** Feature wave: CSAT — the requester's rating, if already given. */
  csat: { score: number; comment: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open — we’re on it',
  pending: 'Replied — waiting for you',
  resolved: 'Resolved',
  closed: 'Closed',
};

export default function TicketStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiRequest<PublicTicket>(`/public/tickets/${token}`);
      setTicket(data);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Ticket not found');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/public/tickets/${token}/messages`, {
        method: 'POST',
        body: { body: reply },
      });
      setReply('');
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send');
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
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-primary">
        Ticket #{ticket.number} · {STATUS_LABEL[ticket.status] ?? ticket.status}
      </p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">{ticket.subject}</h1>

      <div className="mt-5 space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.authorType === 'agent' ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">
                {m.authorType === 'agent' ? (m.authorName ?? 'Support') : 'You'}
              </span>
              <span>{new Date(m.createdAt).toLocaleString('en-GB')}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      {(ticket.status === 'resolved' || ticket.status === 'closed') && (
        <CsatBlock token={token} ticket={ticket} onRated={load} />
      )}

      <form onSubmit={send} className="mt-5 space-y-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Add a reply…"
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={busy || !reply.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

// Feature wave: CSAT + automation — subtle post-resolve rating block.
const CSAT_EMOJI: Array<{ value: number; emoji: string; label: string }> = [
  { value: 1, emoji: '😞', label: 'Bad' },
  { value: 2, emoji: '😐', label: 'Okay' },
  { value: 3, emoji: '😊', label: 'Great' },
];

function CsatBlock({
  token,
  ticket,
  onRated,
}: {
  token: string;
  ticket: PublicTicket;
  onRated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function rate(score: number) {
    setBusy(true);
    setFailed(false);
    try {
      await apiRequest(`/public/tickets/${token}/csat`, { method: 'POST', body: { score } });
      await onRated();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-center">
      <p className="text-sm font-medium">How did we do?</p>
      <div className="mt-2 flex justify-center gap-3">
        {CSAT_EMOJI.map((s) => (
          <button
            key={s.value}
            disabled={busy}
            onClick={() => rate(s.value)}
            aria-label={s.label}
            className={`rounded-lg border px-3 py-1.5 text-xl transition ${
              ticket.csat?.score === s.value
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary'
            }`}
          >
            {s.emoji}
          </button>
        ))}
      </div>
      {ticket.csat && (
        <p className="mt-2 text-xs text-muted-foreground">Thanks for your feedback!</p>
      )}
      {failed && <p className="mt-2 text-xs text-destructive">Could not save — try again.</p>}
    </div>
  );
}

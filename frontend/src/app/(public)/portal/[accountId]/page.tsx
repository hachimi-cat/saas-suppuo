'use client';

/*
 * Hosted customer support portal (suppuo.com/portal/<accountId>) — the
 * turnkey "my tickets" center for Suppuo customers who don't embed their
 * own. Passwordless: enter your email → magic link → 30-day session.
 * Once signed in: open/resolved tabs with counts, ticket list, inline
 * thread + reply, and a new-request form. Rides /api/v1/requester (the
 * cookie-session path of requireRequester).
 */

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Mail,
  Plus,
  ChevronLeft,
  Send,
  CheckCircle2,
  CircleDot,
  Ticket,
} from 'lucide-react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { PortalShell } from '@/components/portal-shell';
import { usePortalBranding } from '@/components/portal-branding';
import { SupportTopNav } from '@/components/support-top-nav';

interface Me {
  email: string;
  accountId: string;
}
interface TicketRow {
  number: number;
  subject: string;
  status: string;
  createdAt: string;
  lastMessageAt: string;
}
interface Counts {
  open: number;
  resolved: number;
}
interface Message {
  id: string;
  authorType: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}
interface TicketDetail {
  number: number;
  subject: string;
  status: string;
  createdAt: string;
  messages: Message[];
}

type Tab = 'open' | 'resolved' | 'all';
const OPEN_STATUSES = ['open', 'pending'];

export default function PortalPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    apiRequest<Me>('/requester/me')
      .then(({ data }) => setMe(data))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return (
      <p className="flex min-h-screen items-center justify-center py-12 text-center text-sm text-muted-foreground">
        Loading…
      </p>
    );
  }
  return me ? (
    <SignedIn accountId={accountId} me={me} onSignOut={() => setMe(null)} />
  ) : (
    <SignIn accountId={accountId} />
  );
}

// ── Sign-in (magic link) ───────────────────────────────────────────────
function SignIn({ accountId }: { accountId: string }) {
  const branding = usePortalBranding();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/public/requester/login', {
        method: 'POST',
        body: { accountId, email },
      });
      setSent(true);
    } catch {
      // Anti-enumeration: the API always 200s; show the same screen.
      setSent(true);
    }
  }

  const name = branding.name || 'Support center';

  return (
    <div className="flex min-h-screen flex-col">
      <SupportTopNav
        accountId={accountId}
        branding={branding}
        action={{ href: `/support/${accountId}`, label: 'Help center' }}
      />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="text-center">
        {branding.logoUrl ? (
          // Padded chip behind the workspace logo (serront storefront-
          // header pattern) so a light mark reads on the themed brand.
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-black/25 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding.logoUrl} alt={name} className="size-full object-contain" />
          </span>
        ) : (
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LifeBuoy className="size-6" strokeWidth={1.75} />
          </span>
        )}
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to view and track your tickets.</p>
      </div>

      {/* Buyer-portal sign-in card (serront /account/sign-in idiom). */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        {sent ? (
          <div className="text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Mail className="size-5" />
            </span>
            <p className="mt-3 text-sm">
              If <strong>{email}</strong> has tickets here, we&apos;ve emailed a sign-in link. It
              expires in 15 minutes.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Ticket className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Magic-link sign-in</p>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll email you a secure link — no password.
                </p>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href={`/support/${accountId}`} className="text-primary hover:underline">
          Back to the help center
        </Link>
      </p>
      </div>
    </div>
  );
}

// ── Signed in: my tickets (inside the buyer-portal Sidebar shell) ───────
function SignedIn({
  accountId,
  me,
  onSignOut,
}: {
  accountId: string;
  me: Me;
  onSignOut: () => void;
}) {
  const branding = usePortalBranding();
  const [tab, setTab] = useState<Tab>('open');
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [counts, setCounts] = useState<Counts>({ open: 0, resolved: 0 });
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback((t: Tab) => {
    apiRequest<{ tickets: TicketRow[]; counts: Counts }>(`/requester/tickets?status=${t}`)
      .then(({ data }) => {
        setRows(data.tickets);
        setCounts(data.counts);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function signOut() {
    await apiRequest('/public/requester/logout', { method: 'POST' }).catch(() => undefined);
    onSignOut();
  }

  let body: React.ReactNode;
  if (composing) {
    body = (
      <NewRequest
        onCancel={() => setComposing(false)}
        onDone={() => {
          setComposing(false);
          setTab('open');
          load('open');
        }}
      />
    );
  } else if (openNumber !== null) {
    body = (
      <TicketThread
        number={openNumber}
        onBack={() => {
          setOpenNumber(null);
          load(tab);
        }}
      />
    );
  } else {
    body = (
      <div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your tickets</h1>
          <p className="text-sm text-muted-foreground">{me.email}</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border border-border p-1 text-sm">
            {(['open', 'resolved', 'all'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 capitalize ${
                  tab === t
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
                {t === 'open' && ` (${counts.open})`}
                {t === 'resolved' && ` (${counts.resolved})`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" /> New request
          </button>
        </div>

        <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No tickets here yet.</p>
          ) : (
            rows.map((t) => (
              <button
                key={t.number}
                onClick={() => setOpenNumber(t.number)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    <span className="truncate font-medium">{t.subject}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    #{t.number} · updated {new Date(t.lastMessageAt).toLocaleDateString()}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <PortalShell accountId={accountId} email={me.email} branding={branding} onLogout={signOut}>
      {body}
    </PortalShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const open = OPEN_STATUSES.includes(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        open ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
      }`}
    >
      {open ? <CircleDot className="size-3" /> : <CheckCircle2 className="size-3" />}
      {status}
    </span>
  );
}

// ── Ticket thread + reply ──────────────────────────────────────────────
function TicketThread({ number, onBack }: { number: number; onBack: () => void }) {
  const [t, setT] = useState<TicketDetail | null | undefined>(undefined);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiRequest<TicketDetail>(`/requester/tickets/${number}`)
      .then(({ data }) => setT(data))
      .catch(() => setT(null));
  }, [number]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/requester/tickets/${number}/messages`, {
        method: 'POST',
        body: { body: reply },
      });
      setReply('');
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Your tickets
      </button>
      {t === undefined ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : t === null ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Ticket not found.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={t.status} />
            <h1 className="text-xl font-bold tracking-tight">{t.subject}</h1>
          </div>
          <p className="text-xs text-muted-foreground">#{t.number}</p>

          <div className="mt-5 space-y-3">
            {t.messages.map((m) => {
              const mine = m.authorType === 'requester';
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3.5 text-sm ${
                    mine ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                  }`}
                >
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {mine ? 'You' : m.authorName || 'Support'} ·{' '}
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                </div>
              );
            })}
          </div>

          <form onSubmit={send} className="mt-5 space-y-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="Write a reply…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            />
            <button
              disabled={busy || !reply.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="size-4" /> {busy ? 'Sending…' : 'Send reply'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

// ── New request ────────────────────────────────────────────────────────
function NewRequest({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/requester/tickets', { method: 'POST', body: { subject, body } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit — try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={onCancel} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Your tickets
      </button>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">New request</h1>
      <form onSubmit={submit} className="mt-5 space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What is this about?"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
        />
        <textarea
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Describe the issue or question…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
        />
        <button
          disabled={busy}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Submit request'}
        </button>
      </form>
    </div>
  );
}

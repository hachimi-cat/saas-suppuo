'use client';

/*
 * Dashboard — the workspace overview: ticket stats by status, recent
 * activity, and quick links into the rest of the portal.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox, KeyRound, Webhook, CreditCard, Settings, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';

interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  lastMessageAt: string;
}

const STATUS_TONES: Record<string, string> = {
  open: 'text-rose-500',
  pending: 'text-amber-500',
  resolved: 'text-emerald-600',
  closed: 'text-muted-foreground',
};

function rel(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function DashboardPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<Ticket[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  // Feature wave: CSAT — average score (1..3) + response count.
  const [csat, setCsat] = useState<{ average: number | null; count: number } | null>(null);

  useEffect(() => {
    apiRequest<{ tickets: Ticket[]; counts: Record<string, number> }>('/tickets?limit=5')
      .then(({ data }) => {
        setRecent(data.tickets);
        setCounts(data.counts);
      })
      .catch(() => undefined);
    apiRequest<{ accountId: string }>('/me')
      .then(({ data }) => setAccountId(data.accountId))
      .catch(() => undefined);
    apiRequest<{ average: number | null; count: number }>('/csat/stats')
      .then(({ data }) => setCsat(data))
      .catch(() => undefined);
  }, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const formUrl =
    accountId && typeof window !== 'undefined'
      ? `${window.location.origin}/support/${accountId}`
      : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Dashboard"
        description="Your support workspace at a glance."
        action={
          <Link href="/dashboard/reports" className="shrink-0 text-xs text-primary hover:underline">
            View reports →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {(['open', 'pending', 'resolved', 'closed'] as const).map((s) => (
          <Link
            key={s}
            href={`/dashboard/inbox`}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s}</p>
            <p className={`mt-1 text-3xl font-semibold tracking-tight ${STATUS_TONES[s]}`}>
              {counts[s] ?? 0}
            </p>
          </Link>
        ))}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">CSAT</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-600">
            {csat?.average != null ? csat.average.toFixed(1) : '—'}
            <span className="text-sm font-normal text-muted-foreground"> / 3</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {csat ? `${csat.count} rating${csat.count === 1 ? '' : 's'}` : ' '}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent tickets
            </h2>
            <Link href="/dashboard/inbox" className="text-xs text-primary hover:underline">
              Open inbox →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {recent.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tickets yet ({total} total). Share your support form to get started.
              </p>
            )}
            {recent.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/tickets/${t.id}`}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary"
              >
                <span className="font-mono text-xs text-muted-foreground">#{t.number}</span>
                <span className="min-w-0 flex-1 truncate">{t.subject}</span>
                <span className={`text-xs capitalize ${STATUS_TONES[t.status] ?? ''}`}>{t.status}</span>
                <span className="text-xs text-muted-foreground">{rel(t.lastMessageAt)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your support form
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Customers submit tickets here — share it anywhere.
          </p>
          {formUrl && (
            <code className="mt-2 block truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              {formUrl}
            </code>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <QuickLink href="/dashboard/api-keys" icon={<KeyRound className="h-4 w-4" />} label="API Keys" />
            <QuickLink href="/dashboard/webhooks" icon={<Webhook className="h-4 w-4" />} label="Webhooks" />
            <QuickLink href="/dashboard/billing" icon={<CreditCard className="h-4 w-4" />} label="Billing" />
            <QuickLink href="/dashboard/settings" icon={<Settings className="h-4 w-4" />} label="Settings" />
          </div>
          <a
            href="/docs"
            target="_blank"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Read the docs
          </a>
        </section>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  );
}

'use client';

/*
 * Hosted ticket form — "Submit a request" / "talk to a human" from the
 * help center (/support/<accountId>/new). The help center is the front
 * door; this is the fallback when search/FAQ/live chat didn't resolve it.
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useSetHideBranding } from '@/components/public-branding';

export default function SupportFormPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  // Honeypot — hidden from humans, auto-filled by bots; any value = bot.
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: number; accessToken: string } | null>(null);
  const setHideBranding = useSetHideBranding();

  useEffect(() => {
    apiRequest<{ hideBranding: boolean }>(`/public/widget-config?account=${accountId}`)
      .then(({ data }) => {
        if (data.hideBranding) setHideBranding(true);
      })
      .catch(() => undefined);
  }, [accountId, setHideBranding]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiRequest<{ number: number; accessToken: string }>(
        '/public/tickets',
        {
          method: 'POST',
          body: { accountId, subject, email, name: name || undefined, body, company: company || undefined },
        },
      );
      setDone(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit — try again.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-3xl">✅</p>
          <h1 className="mt-2 text-xl font-bold">Request received — ticket #{done.number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ve emailed you a link to follow progress. You can also open it now:
          </p>
          <a
            href={`/t/${done.accessToken}`}
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            View your ticket
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/support/${accountId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Help center
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Submit a request</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell us what you need — we&apos;ll reply by email.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {/* Honeypot — off-screen, not display:none, aria-hidden + tabindex
            -1 + autocomplete off so humans never reach it; bots auto-fill. */}
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
        />
        <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What is this about?" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        </div>
        <textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe the issue or question…" rows={6} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </div>
  );
}

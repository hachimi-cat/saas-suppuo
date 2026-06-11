'use client';

/*
 * Feature wave: CSAT + automation — tokenized rating page
 * (/t/<token>/rate?score=1|2|3). The links in the post-resolve survey
 * email land here: a valid ?score= submits in one click on load, then
 * the requester may adjust the rating or add an optional comment.
 */

import { Suspense, use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useSetHideBranding } from '@/components/public-branding';

const SCORES = [
  { value: 1, emoji: '😞', label: 'Bad' },
  { value: 2, emoji: '😐', label: 'Okay' },
  { value: 3, emoji: '😊', label: 'Great' },
] as const;

export default function RatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
      <RateForm token={token} />
    </Suspense>
  );
}

function RateForm({ token }: { token: string }) {
  const search = useSearchParams();
  const urlScore = Number(search.get('score'));
  const initialScore = Number.isInteger(urlScore) && urlScore >= 1 && urlScore <= 3 ? urlScore : null;

  const [score, setScore] = useState<number | null>(initialScore);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSubmitted = useRef(false);
  const setHideBranding = useSetHideBranding();

  // Branding flag rides on the public ticket payload.
  useEffect(() => {
    apiRequest<{ hideBranding?: boolean }>(`/public/tickets/${token}`)
      .then(({ data }) => {
        if (data.hideBranding) setHideBranding(true);
      })
      .catch(() => undefined);
  }, [token, setHideBranding]);

  async function submit(s: number, c?: string) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/public/tickets/${token}/csat`, {
        method: 'POST',
        body: { score: s, ...(c?.trim() ? { comment: c.trim() } : {}) },
      });
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.code === 'CONFLICT'
            ? 'This ticket isn’t resolved yet — ratings open once it is.'
            : e.message
          : 'Could not save your rating',
      );
    } finally {
      setBusy(false);
    }
  }

  // One-click path: the email link carries ?score= — submit it on load.
  useEffect(() => {
    if (initialScore !== null && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit(initialScore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-primary">How did we do?</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">Rate your support experience</h1>

      <div className="mt-6 flex justify-center gap-4">
        {SCORES.map((s) => (
          <button
            key={s.value}
            disabled={busy}
            onClick={() => {
              setScore(s.value);
              void submit(s.value, comment);
            }}
            className={`flex h-20 w-20 flex-col items-center justify-center rounded-xl border text-3xl transition ${
              score === s.value
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary'
            }`}
            aria-label={s.label}
          >
            <span>{s.emoji}</span>
            <span className="mt-1 text-[11px] text-muted-foreground">{s.label}</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {saved && !error && (
        <p className="mt-4 text-sm text-emerald-600">Thanks — your rating was saved.</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (score !== null) void submit(score, comment);
        }}
        className="mt-6 space-y-2 text-left"
      >
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything to add? (optional)"
          rows={3}
          maxLength={2000}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={busy || score === null}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Saving…' : saved ? 'Update rating' : 'Submit'}
        </button>
      </form>

      <Link href={`/t/${token}`} className="mt-4 inline-block text-xs text-primary hover:underline">
        ← Back to your ticket
      </Link>
    </div>
  );
}

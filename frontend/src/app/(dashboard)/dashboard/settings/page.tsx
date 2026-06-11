'use client';

/*
 * Workspace settings — the shareable hosted-form URL and automation
 * (auto-response + business hours, WIB-aware). Canned replies moved to
 * their own page at /dashboard/canned-replies.
 * The accountId comes from /api/v1/auth/me (the BFF session).
 */

import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';

export default function SettingsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiRequest<{ accountId: string }>('/me')
      .then(({ data }) => setAccountId(data.accountId))
      .catch(() => setAccountId(null));
  }, []);

  const formUrl = accountId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/support/${accountId}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
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

      <BrandingSection />

      <AutomationSection />
    </div>
  );
}

// ─── Branding (paid-tier perk; unenforced during early access) ───────

function BrandingSection() {
  const [hide, setHide] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{ hideBranding: boolean }>('/settings/automation')
      .then(({ data }) => setHide(data.hideBranding))
      .catch(() => setHide(false));
  }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    setHide(next);
    try {
      await apiRequest('/settings/automation', { method: 'PUT', body: { hideBranding: next } });
    } catch {
      setHide(!next); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Branding
      </h2>
      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={hide ?? false}
          disabled={hide === null || saving}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span className="text-sm">
          Hide “Powered by Suppuo”
          <span className="block text-xs text-muted-foreground">
            Removes the footer from requester emails, the live chat widget, and your hosted
            form + ticket status pages. A paid-tier perk — free for everyone during early
            access.
          </span>
        </span>
      </label>
    </section>
  );
}

// ─── Feature wave: CSAT + automation ─────────────────────────────────
// Automation settings: business-hours grid (7 days, WIB) + the
// inside/outside auto-response templates + the master toggle.

interface DayHours {
  enabled: boolean;
  open: string;
  close: string;
}

interface AutomationSettings {
  businessHours: {
    tz: string;
    days: Array<{ dow: number; open: string; close: string } | null>;
  } | null;
  autoResponseEnabled: boolean;
  autoResponseInside: string | null;
  autoResponseOutside: string | null;
}

// UI rows Monday-first; dow indices are 0 = Sunday … 6 = Saturday.
const DAY_ROWS: Array<{ dow: number; label: string }> = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
];

function defaultDays(): Record<number, DayHours> {
  const d: Record<number, DayHours> = {};
  for (const { dow } of DAY_ROWS) {
    d[dow] = { enabled: dow >= 1 && dow <= 5, open: '09:00', close: '17:00' };
  }
  return d;
}

function AutomationSection() {
  const [enabled, setEnabled] = useState(false);
  const [inside, setInside] = useState('');
  const [outside, setOutside] = useState('');
  const [days, setDays] = useState<Record<number, DayHours>>(defaultDays());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<AutomationSettings>('/settings/automation')
      .then(({ data }) => {
        setEnabled(data.autoResponseEnabled);
        setInside(data.autoResponseInside ?? '');
        setOutside(data.autoResponseOutside ?? '');
        if (data.businessHours?.days) {
          const next = defaultDays();
          for (const { dow } of DAY_ROWS) {
            const entry = data.businessHours.days[dow];
            next[dow] = entry
              ? { enabled: true, open: entry.open, close: entry.close }
              : { ...next[dow], enabled: false };
          }
          setDays(next);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  function setDay(dow: number, patch: Partial<DayHours>) {
    setDays((d) => ({ ...d, [dow]: { ...d[dow], ...patch } }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const daysJson = Array.from({ length: 7 }, (_, dow) =>
        days[dow]?.enabled ? { dow, open: days[dow].open, close: days[dow].close } : null,
      );
      await apiRequest('/settings/automation', {
        method: 'PUT',
        body: {
          businessHours: { tz: 'Asia/Jakarta', days: daysJson },
          autoResponseEnabled: enabled,
          autoResponseInside: inside.trim() || null,
          autoResponseOutside: outside.trim() || null,
        },
      });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Automation
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Send an automatic first reply on every new ticket — a different message inside vs.
        outside your business hours.
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
        />
        Enable auto-response
      </label>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Business hours <span className="font-normal normal-case">(WIB — Asia/Jakarta)</span>
        </p>
        <div className="mt-2 space-y-1.5">
          {DAY_ROWS.map(({ dow, label }) => (
            <div key={dow} className="flex items-center gap-3 text-sm">
              <label className="flex w-28 items-center gap-2">
                <input
                  type="checkbox"
                  checked={days[dow]?.enabled ?? false}
                  onChange={(e) => setDay(dow, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                {label}
              </label>
              {days[dow]?.enabled ? (
                <>
                  <input
                    type="time"
                    value={days[dow].open}
                    onChange={(e) => setDay(dow, { open: e.target.value })}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={days[dow].close}
                    onChange={(e) => setDay(dow, { close: e.target.value })}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  />
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Inside business hours
          </label>
          <textarea
            value={inside}
            onChange={(e) => setInside(e.target.value)}
            rows={4}
            placeholder="Thanks! We're online — an agent will reply shortly."
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Outside business hours
          </label>
          <textarea
            value={outside}
            onChange={(e) => setOutside(e.target.value)}
            rows={4}
            placeholder="Thanks! We're currently offline — we'll get back to you next business day."
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Leave a template empty to stay silent in that window.
      </p>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <button
        onClick={save}
        disabled={!loaded || saving}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? 'Saving…' : savedAt ? 'Saved ✓' : 'Save automation settings'}
      </button>
    </section>
  );
}

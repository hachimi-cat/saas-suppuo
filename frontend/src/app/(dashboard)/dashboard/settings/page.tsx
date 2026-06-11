'use client';

/*
 * Workspace settings — your agent profile (display name via the Huudis
 * proxy + a suppuo-local avatar), the shareable hosted-form URL and
 * automation (auto-response + business hours, WIB-aware). Canned
 * replies moved to their own page at /dashboard/canned-replies.
 * The accountId comes from /api/v1/auth/me (the BFF session).
 */

import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiRequestError, apiUrl } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';

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

      <ProfileSection />

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

// ─── Your profile (name lives in Huudis; avatar is suppuo-local) ─────
// Display name reads/writes go through the BFF Huudis proxy
// (/api/v1/huudis/account) — Suppuo never shows a Huudis page. The
// avatar has no home in Huudis, so it lives in Suppuo's own
// agent_profiles table keyed by the Huudis sub.

const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_AVATAR_BYTES = 1 * 1024 * 1024; // 1MB — matches the backend cap

function ProfileSection() {
  const [sub, setSub] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Name save state.
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Avatar state. `avatarVersion` busts the <img> cache after changes.
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Own sub for the avatar endpoints.
    apiRequest<{ sub: string }>('/me')
      .then(({ data }) => setSub(data.sub))
      .catch(() => setSub(null));
    // Display name from Huudis via the BFF proxy. The proxy forwards
    // Huudis's own envelope: { data: { id, email, name, … } }.
    fetch('/api/v1/huudis/account', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as {
          data?: { name?: string; email?: string };
        } | null;
        if (typeof body?.data?.name === 'string') setName(body.data.name);
        if (typeof body?.data?.email === 'string') setEmail(body.data.email);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingName(true);
    setNameError(null);
    setNameSaved(false);
    try {
      const res = await fetch('/api/v1/huudis/account', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Could not save (${res.status})`);
      }
      setNameSaved(true);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSavingName(false);
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarError(null);
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Please choose a PNG, JPG or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image is too large — 1MB max.');
      return;
    }
    setAvatarBusy(true);
    try {
      const res = await fetch(apiUrl('/profile/avatar'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
      }
      setAvatarVersion((v) => v + 1);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAvatarBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await apiRequest('/profile/avatar', { method: 'DELETE' });
      setAvatarVersion((v) => v + 1);
    } catch (err) {
      setAvatarError(err instanceof ApiRequestError ? err.message : 'Could not remove');
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Your profile
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        How you appear to teammates — on ticket assignments and replies.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar
            sub={sub}
            nameOrEmail={name || email}
            size={64}
            version={avatarVersion}
            className="text-lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={avatarBusy || !sub}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50 disabled:opacity-50"
              >
                {avatarBusy ? 'Working…' : 'Upload photo'}
              </button>
              <button
                type="button"
                onClick={removeAvatar}
                disabled={avatarBusy || !sub}
                className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                Remove
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPG or WebP — 1MB max.</p>
            {avatarError && <p className="mt-1 text-xs text-destructive">{avatarError}</p>}
          </div>
        </div>

        {/* Display name */}
        <form onSubmit={saveName} className="min-w-[260px] flex-1">
          <label
            htmlFor="profile-name"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Display name
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="profile-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameSaved(false);
              }}
              disabled={!loaded}
              maxLength={120}
              placeholder={loaded ? 'Your name' : 'Loading…'}
              className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              disabled={!loaded || savingName || !name.trim()}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {savingName ? 'Saving…' : 'Save'}
            </button>
          </div>
          {email && <p className="mt-1 text-xs text-muted-foreground">{email}</p>}
          {nameSaved && (
            <p className="mt-1.5 text-xs text-emerald-600">
              Saved — your name updates everywhere within a few minutes.
            </p>
          )}
          {nameError && <p className="mt-1.5 text-xs text-destructive">{nameError}</p>}
        </form>
      </div>
    </section>
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

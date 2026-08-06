'use client';

/*
 * Workspaces — list the Huudis workspaces you belong to, switch the
 * active one (drives which inbox/settings/billing you operate), and
 * create new workspaces via the Huudis proxy.
 */

import { useCallback, useEffect, useState } from 'react';
import { writeActiveWorkspace } from '@forjio/portal-ui';
import { PageHeader } from '@/components/dashboard/page-header';

interface Workspace {
  id: string;
  name: string;
  slug?: string;
  role: string;
  isForjioInternal?: boolean;
}

const BRAND_SLUG = 'suppuo';

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [personalId, setPersonalId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/huudis/account/workspaces', { credentials: 'include' });
      const b = await r.json();
      setWorkspaces(Array.isArray(b?.data) ? b.data : []);
    } catch {
      setError('Could not load workspaces');
    }
    try {
      const me = await fetch('/api/v1/me', { credentials: 'include' }).then((r) => r.json());
      setActiveId(me?.data?.accountId ?? null);
    } catch {
      /* ignore */
    }
    try {
      const auth = await fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json());
      setPersonalId(auth?.data?.user?.id ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function activate(id: string) {
    writeActiveWorkspace('cookie', BRAND_SLUG, id);
    // The backend resolves the cookie per request — reload so every
    // page reflects the newly-active workspace.
    window.location.href = '/dashboard';
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/v1/huudis/account/workspaces', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => null);
        throw new Error(b?.error?.message ?? `Create failed (${r.status})`);
      }
      setName('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Workspaces"
        description={
          <>
            Each workspace has its own inbox, form, billing and settings. Managed in{' '}
            <a href="https://huudis.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Huudis
            </a>
            , usable everywhere in the Forjio family.
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        {personalId && (
          <WorkspaceRow
            name="Personal workspace"
            sub="Your private inbox — not shared with a team"
            role="owner"
            active={activeId === personalId}
            onActivate={() => activate(personalId)}
          />
        )}
        {workspaces.map((w) => (
          <WorkspaceRow
            key={w.id}
            name={w.name}
            sub={w.slug ?? w.id}
            role={w.role}
            active={activeId === w.id}
            onActivate={() => activate(w.id)}
          />
        ))}
      </div>

      <form onSubmit={createWorkspace} className="mt-6 flex max-w-md gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New workspace name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={busy}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create'}
        </button>
      </form>
    </div>
  );
}

function WorkspaceRow({
  name,
  sub,
  role,
  active,
  onActivate,
}: {
  name: string;
  sub: string;
  role: string;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
        {role}
      </span>
      {active ? (
        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Active
        </span>
      ) : (
        <button
          onClick={onActivate}
          className="rounded-lg border border-border px-3 py-1 text-xs hover:border-primary"
        >
          Switch
        </button>
      )}
    </div>
  );
}

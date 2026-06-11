'use client';

import { useEffect, useState } from 'react';
import { Hexagon, Inbox, Menu, Settings } from 'lucide-react';
import {
  Sidebar,
  readActiveWorkspaceId,
  type PortalWorkspace,
  type SessionUser,
  type NavSection,
} from '@forjio/portal-ui';

/*
 * Dashboard shell — the authenticated portal chrome. `@forjio/portal-ui`
 * Sidebar renders the workspace switcher, nav, and profile dropdown;
 * the host (this file) supplies the workspace list, active id, nav
 * sections, user, the mobile-drawer open state, and the logout handler.
 *
 * FORKERS: add your portal pages as `SECTIONS` entries below. Keep
 * "Overview → Dashboard" first. Workspace persistence is `cookie` —
 * the family canon; do not switch to localStorage.
 */

// rename.sh rewrites "Suppuo" / "suppuo" / "#F43F5E".
const BRAND = 'Suppuo';
const BRAND_SLUG = 'suppuo';
const BRAND_COLOR = '#F43F5E';

const SECTIONS: NavSection[] = [
  {
    label: 'Support',
    items: [
      { href: '/dashboard', label: 'Inbox', icon: Inbox },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

async function logout() {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    /* clear client state regardless */
  }
  window.location.href = '/login';
}

export function DashboardShell({
  user,
  accountId,
  children,
}: {
  user: SessionUser;
  /** The user's own derived account id, from /auth/me. Used as the
   *  fallback workspace until a product wires a real workspace list. */
  accountId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // The user always has at least their own account — so the switcher
  // shows a real name even before a product ships /account/workspaces.
  const fallback: PortalWorkspace = {
    id: accountId,
    name: user?.name ? `${user.name}'s workspace` : 'My workspace',
    role: 'owner',
  };
  const [workspaces, setWorkspaces] = useState<PortalWorkspace[]>([fallback]);
  const [activeId, setActiveId] = useState<string>(accountId);

  useEffect(() => {
    const cookieId = readActiveWorkspaceId('cookie', BRAND_SLUG);
    // Best-effort — the template ships no /account/workspaces endpoint;
    // a forked product that proxies Huudis workspaces populates it.
    fetch('/api/v1/account/workspaces', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        const list = (b?.data ?? []) as PortalWorkspace[];
        const ws = Array.isArray(list) && list.length ? list : [fallback];
        setWorkspaces(ws);
        setActiveId(cookieId && ws.some((w) => w.id === cookieId) ? cookieId : ws[0].id);
      })
      .catch(() => {
        if (cookieId) setActiveId(cookieId);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        brandSlug={BRAND_SLUG}
        brandName={BRAND}
        brandColor={BRAND_COLOR}
        brandIcon={<Hexagon size={20} strokeWidth={2} />}
        workspacePersist="cookie"
        workspaces={workspaces}
        activeWorkspaceId={activeId}
        sections={SECTIONS}
        user={user}
        onLogout={logout}
        open={open}
        onClose={() => setOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — the Sidebar drawer has no open trigger of
            its own, so the host renders one. Hidden on lg+. */}
        <div className="flex h-14 items-center border-b border-border bg-card px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-foreground">
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { LogoMark } from '@/components/brand/logo';
import {
  Activity,
  Building2,
  Flag,
  LayoutDashboard,
  LineChart,
  Ticket,
  Users,
  Receipt,
} from 'lucide-react';
import { MobileHeader, Sidebar, type SessionUser, type NavSection } from '@forjio/portal-ui';

/*
 * Admin portal shell — the authenticated chrome for the built-in admin
 * console. Mirrors `dashboard-shell.tsx` (the merchant portal chrome)
 * but runs the `@forjio/portal-ui` Sidebar in **no-workspace mode**:
 * the `workspaces` / `activeWorkspaceId` / `workspacePersist` props are
 * omitted, so no workspace switcher is rendered — admins have no
 * per-workspace concept, they administer the whole product.
 *
 * `brandTag="Admin"` renders a small uppercase "Admin" subtitle under
 * the brand name, so the admin portal is visually distinct from the
 * merchant dashboard.
 *
 * FORKERS: add your admin pages as `SECTIONS` entries below — keep
 * "Overview → Dashboard" first. rename.sh rewrites "Suppuo" /
 * "suppuo" / "#F43F5E".
 */

// rename.sh rewrites these placeholders.
const BRAND = 'Suppuo';
const BRAND_SLUG = 'suppuo';
const BRAND_COLOR = 'hsl(var(--primary))';
const BRAND_COLOR_SOFT = 'hsl(var(--primary) / 0.15)';

const SECTIONS: NavSection[] = [
  // The FOUR GROUPS, in this order, in every Forjio admin portal:
  // Overview / Customers / Platform / Operations. An operator who knows
  // one portal knows all thirteen, so the names and the order are fixed
  // even where a product has nothing to put in a group.
  {
    label: 'Overview',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Customers',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/transactions', label: 'Transactions', icon: Receipt },
      { href: '/admin/workspaces', label: 'Workspaces', icon: Building2 },
      { href: '/admin/tickets', label: 'Tickets', icon: Ticket },
    ],
  },
  // The MANDATORY admin-portal standard — every Forjio product ships
  // these. See forjio/documentation/2. Technical/13-Admin-Portal-Standard.md.
  // Product sections go alongside them, never in place of them.
  {
    label: 'Platform',
    items: [
      { href: '/admin/metrics', label: 'Business metrics', icon: LineChart },
      { href: '/admin/system', label: 'System metrics', icon: Activity },
      { href: '/admin/feature-flags', label: 'Feature flags', icon: Flag },
    ],
  },
  // Products add their own admin sections here, e.g.:
  // { label: 'Operations', items: [{ href: '/admin/kyc', label: 'KYC', icon: ShieldCheck }] },
];

async function logout() {
  try {
    // The admin role's session cookie is resolved by the role header
    // the admin BFF proxy stamps — logout goes through the same proxy.
    await fetch('/api/v1/console/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    /* clear client state regardless */
  }
  window.location.href = '/admin/login';
}

export function AdminShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        brandSlug={BRAND_SLUG}
        brandName={BRAND}
        brandTag="Admin"
        brandHref="/admin/dashboard"
        brandColor={BRAND_COLOR}
        brandColorSoft={BRAND_COLOR_SOFT}
        brandIcon={<LogoMark size={20} />}
        sections={SECTIONS}
        user={user}
        onLogout={logout}
        open={open}
        onClose={() => setOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone-only island header — brand island + burger (opens the
            Sidebar drawer). No-workspace mode. Hidden on lg+. */}
        <MobileHeader
          brandSlug={BRAND_SLUG}
          brandName={BRAND}
          brandHref="/admin/dashboard"
          brandColor={BRAND_COLOR}
          brandColorSoft={BRAND_COLOR_SOFT}
          brandIcon={<LogoMark size={20} />}
          onMenuOpen={() => setOpen(true)}
        />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

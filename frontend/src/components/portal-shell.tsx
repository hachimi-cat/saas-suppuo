'use client';

/*
 * Customer ticket-portal chrome for /portal/<accountId> (signed-in
 * area) — a thin host around `@forjio/portal-ui` Sidebar in
 * **no-workspace mode** (workspaces / activeWorkspaceId / workspacePersist
 * omitted → no switcher), mirroring serront's ClientPortalShell.
 *
 *  - Brand header = the workspace's own support identity (its branding
 *    logo + name), not "Suppuo".
 *  - brandColor follows the themed `--primary` so the active-pill /
 *    avatar match the workspace accent.
 *  - Nav: a "Support" section (My tickets) + a "Help" section linking
 *    back to the public help center.
 *  - Sign-out runs the requester logout and drops back to the sign-in
 *    screen (handled by the parent via onLogout).
 *  - Layout mirrors serront: the only chrome outside the sidebar is the
 *    phone-only `MobileHeader` island chrome (brand island + burger).
 */

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, LifeBuoy, Mail, Ticket } from 'lucide-react';
import { MobileHeader, Sidebar, type NavSection, type SessionUser } from '@forjio/portal-ui';
import type { PublicBranding } from '@/lib/theme';
import { currentHost, hcHome, portalPath } from '@/lib/host-routing';

export function PortalShell({
  accountId,
  email,
  branding,
  onLogout,
  children,
}: {
  accountId: string;
  email?: string | null;
  branding: PublicBranding;
  onLogout: () => void | Promise<void>;
  children: ReactNode;
}) {
  // Read so a route change re-renders the shell; portal-ui resolves the
  // active item from the pathname internally — which on a custom domain is
  // the CLEAN `/portal`, so the nav hrefs must be clean too (else the
  // active pill never matches). Read the host after mount (SSR-safe).
  usePathname();
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => setHost(currentHost()), []);

  const name = branding.name || 'Support';
  const base = portalPath(host, accountId);
  const helpHome = hcHome(host, accountId);
  // Documentation + Contact link out to the product's own pages (new tab,
  // via onClick so the portal stays open); shown only when configured.
  const open2 = (url: string) => () => window.open(url, '_blank', 'noopener');
  const helpItems: NavSection['items'] = [
    { href: helpHome, label: 'Help center', icon: LifeBuoy },
  ];
  if (branding.docsUrl) helpItems.push({ onClick: open2(branding.docsUrl), label: 'Documentation', icon: BookOpen });
  if (branding.contactUrl) helpItems.push({ onClick: open2(branding.contactUrl), label: 'Contact', icon: Mail });
  const sections: NavSection[] = [
    {
      label: 'Support',
      items: [{ href: base, label: 'My tickets', icon: Ticket }],
    },
    { label: 'Help', items: helpItems },
  ];
  const sessionUser: SessionUser | null = email ? { email } : null;

  // One brand icon, shared by the desktop Sidebar and the phone-only
  // MobileHeader island so the two always render the same identity.
  const brandIcon = branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={branding.logoUrl}
      alt={name}
      style={{ width: 24, height: 24, flex: '0 0 24px', objectFit: 'contain' }}
    />
  ) : (
    <span
      aria-hidden
      style={{
        width: 24,
        height: 24,
        flex: '0 0 24px',
        borderRadius: 6,
        background: 'var(--brand-soft)',
        color: 'var(--brand-color)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        textTransform: 'uppercase',
      }}
    >
      {name.slice(0, 1)}
    </span>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        brandSlug={accountId}
        brandName={name}
        brandHref={base}
        brandColor="hsl(var(--primary))"
        brandColorSoft="hsl(var(--primary) / 0.15)"
        brandIcon={brandIcon}
        sections={sections}
        user={sessionUser}
        onLogout={onLogout}
        open={open}
        onClose={() => setOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone-only island header — brand island + burger (opens the
            Sidebar drawer). No-workspace mode. Hidden on lg+. */}
        <MobileHeader
          brandSlug={accountId}
          brandName={name}
          brandHref={base}
          brandColor="hsl(var(--primary))"
          brandColorSoft="hsl(var(--primary) / 0.15)"
          brandIcon={brandIcon}
          onMenuOpen={() => setOpen(true)}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

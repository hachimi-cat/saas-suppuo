'use client';

/*
 * Marketing-style top header for the customer support surfaces (the
 * public help center + the portal sign-in screen). Logo chip + workspace
 * name on the left (links to the help center home), an action button on
 * the right. Mirrors the family marketing-nav chrome; themed by the
 * workspace brand because it renders inside the themed subtree.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import type { PublicBranding } from '@/lib/theme';
import { currentHost, hcHome, portalPath, hcPath } from '@/lib/host-routing';

export function SupportTopNav({
  accountId,
  branding,
  action,
}: {
  accountId: string;
  branding: PublicBranding;
  // `action.to` is host-aware: 'portal' → the customer portal, 'help' →
  // the help-center home. (Legacy `href` still accepted for any non-route
  // target, but the two built-in destinations resolve per-host.)
  action?: { to: 'portal' | 'help'; label: string };
}) {
  const name = branding.name || 'Support';
  // Read the live host after mount so links flip to clean paths on a
  // custom domain. Before mount we emit Suppuo/handle paths (SSR-safe).
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => setHost(currentHost()), []);

  const homeHref = hcHome(host, accountId);
  const actionHref = action
    ? action.to === 'portal'
      ? portalPath(host, accountId)
      : hcPath(host, accountId)
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5">
          {branding.logoUrl ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={branding.logoUrl} alt={name} className="size-full object-contain" />
            </span>
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <LifeBuoy className="size-4" strokeWidth={1.75} />
            </span>
          )}
          <span className="truncate text-sm font-semibold tracking-[-0.01em]">{name}</span>
        </Link>
        {action && actionHref && (
          <Link
            href={actionHref}
            className="shrink-0 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {action.label}
          </Link>
        )}
      </div>
    </header>
  );
}

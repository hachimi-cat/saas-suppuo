'use client';

/*
 * Marketing-style top header for the customer support surfaces (the
 * public help center + the portal sign-in screen). Logo chip + workspace
 * name on the left (links to the help center home), an action button on
 * the right. Mirrors the family marketing-nav chrome; themed by the
 * workspace brand because it renders inside the themed subtree.
 */

import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import type { PublicBranding } from '@/lib/theme';

export function SupportTopNav({
  accountId,
  branding,
  action,
}: {
  accountId: string;
  branding: PublicBranding;
  action?: { href: string; label: string };
}) {
  const name = branding.name || 'Support';
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href={`/support/${accountId}`} className="flex min-w-0 items-center gap-2.5">
          {branding.logoUrl ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/25 p-1.5">
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
        {action && (
          <Link
            href={action.href}
            className="shrink-0 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {action.label}
          </Link>
        )}
      </div>
    </header>
  );
}

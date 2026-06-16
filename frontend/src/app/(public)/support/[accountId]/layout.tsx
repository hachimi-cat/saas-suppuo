'use client';

/*
 * Help-center subtree layout (/support/<accountId>/*). Two jobs:
 *
 *  1. THEME — fetches the workspace's public branding once
 *     (/public/help/<acc>/branding, unauthenticated) and applies the
 *     derived accent + brand CSS-vars (storefrontThemeVars) to a wrapper
 *     so the help center, the ticket form, and article readers all theme
 *     to the brand. Best-effort: renders unthemed while loading / on
 *     error, never blocking the child pages' own data fetch.
 *
 *  2. CHROME — the centered reading column (max-w-3xl) + the
 *     context-gated powered-by footer that used to live in the (public)
 *     root layout. Kept here (not at the root) so the sibling portal can
 *     go full-bleed for its Sidebar shell.
 */

import { use, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { apiRequest } from '@/lib/api';
import { PoweredByFooter } from '@/components/public-branding';
import { storefrontThemeVars, type PublicBranding } from '@/lib/theme';

export default function SupportThemeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<PublicBranding>(`/public/help/${accountId}/branding`)
      .then(({ data }) => {
        if (!cancelled) setBranding(data);
      })
      .catch(() => {
        /* leave unthemed — pages render their own error/loading state */
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const vars = branding ? storefrontThemeVars(branding.accentColor, branding.brandColor) : {};
  const style = Object.keys(vars).length > 0 ? (vars as CSSProperties) : undefined;

  return (
    <div style={style} className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-12">
        {children}
        <PoweredByFooter />
      </main>
    </div>
  );
}

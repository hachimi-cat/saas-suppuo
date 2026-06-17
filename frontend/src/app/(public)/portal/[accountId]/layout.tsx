'use client';

/*
 * Customer ticket-portal subtree layout (/portal/<accountId>/*).
 *
 * Fetches the workspace's public branding once (works PRE-auth via
 * /public/help/<acc>/branding) and:
 *   1. applies the derived accent + brand CSS-vars to a full-bleed
 *      wrapper so BOTH the sign-in screen and the signed-in Sidebar
 *      shell theme to the brand, and
 *   2. publishes the branding object through a context so the page (and
 *      the Sidebar shell) can render the workspace logo + name without
 *      re-fetching.
 *
 * Full-bleed (no max-width clamp here) — the signed-in area mounts the
 * buyer-portal Sidebar which needs the full viewport. Best-effort: while
 * loading / on error it renders unthemed with empty branding, and the
 * child page still works.
 */

import { use, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Script from 'next/script';
import { apiRequest } from '@/lib/api';
import { storefrontThemeVars, EMPTY_BRANDING, type PublicBranding } from '@/lib/theme';
import { PortalBrandingProvider } from '@/components/portal-branding';

// Cache-buster for the embedded widget.js — keep in sync with the help
// center's WIDGET_VERSION.
const WIDGET_VERSION = '2026-06-17a';

export default function PortalThemeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const [branding, setBranding] = useState<PublicBranding>(EMPTY_BRANDING);

  useEffect(() => {
    let cancelled = false;
    apiRequest<PublicBranding>(`/public/help/${accountId}/branding`)
      .then(({ data }) => {
        if (!cancelled) setBranding(data);
      })
      .catch(() => {
        /* leave default — page still works unthemed */
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const vars = storefrontThemeVars(branding.accentColor, branding.brandColor);
  const style = Object.keys(vars).length > 0 ? (vars as CSSProperties) : undefined;

  return (
    <PortalBrandingProvider branding={branding}>
      {/* Live-chat bubble on the portal too (sign-in + signed-in), themed
          to the workspace accent — same widget as the help center. */}
      <Script
        src={`/widget.js?v=${WIDGET_VERSION}`}
        data-suppuo-account={accountId}
        data-suppuo-accent={branding.accentColor ?? ''}
        strategy="afterInteractive"
      />
      <div style={style} className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    </PortalBrandingProvider>
  );
}

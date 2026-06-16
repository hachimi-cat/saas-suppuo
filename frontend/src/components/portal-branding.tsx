'use client';

/*
 * Context that carries a workspace's public branding (logo / name /
 * colors) down the /portal/<accountId> subtree. The portal layout fetches
 * it once (pre-auth) and provides it; the sign-in screen and the
 * signed-in Sidebar shell consume it via usePortalBranding(). Lives in
 * its own module because a Next.js layout file may only export the
 * component + route config — not extra hooks.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { EMPTY_BRANDING, type PublicBranding } from '@/lib/theme';

const PortalBrandingContext = createContext<PublicBranding>(EMPTY_BRANDING);

export function PortalBrandingProvider({
  branding,
  children,
}: {
  branding: PublicBranding;
  children: ReactNode;
}) {
  return (
    <PortalBrandingContext.Provider value={branding}>{children}</PortalBrandingContext.Provider>
  );
}

/** The workspace's public branding for this portal subtree (logo / name
 *  / colors). Empty defaults until the layout's fetch resolves. */
export function usePortalBranding(): PublicBranding {
  return useContext(PortalBrandingContext);
}

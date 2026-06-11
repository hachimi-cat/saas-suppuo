'use client';

/*
 * "Powered by Suppuo" on the public (requester-facing) pages — the
 * hosted form, the tokenized status page, and the rating page.
 * Workspaces with the hideBranding setting (paid-tier perk) suppress
 * it: pages learn the flag from their own data fetch (the public
 * ticket GET carries `hideBranding`; the form uses /public/widget-config)
 * and flip this context, which the layout's footer consumes.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

const BrandingContext = createContext<{ hide: boolean; setHide: (v: boolean) => void }>({
  hide: false,
  setHide: () => {},
});

export function PublicBrandingProvider({ children }: { children: ReactNode }) {
  const [hide, setHide] = useState(false);
  return (
    <BrandingContext.Provider value={{ hide, setHide }}>{children}</BrandingContext.Provider>
  );
}

export function useSetHideBranding(): (v: boolean) => void {
  return useContext(BrandingContext).setHide;
}

export function PoweredByFooter() {
  const { hide } = useContext(BrandingContext);
  if (hide) return null;
  return (
    <p className="mt-10 text-center text-xs text-muted-foreground">
      Powered by{' '}
      <a href="/" className="font-semibold text-primary hover:underline">
        Suppuo
      </a>{' '}
      — helpdesk for Indonesian SMEs
    </p>
  );
}

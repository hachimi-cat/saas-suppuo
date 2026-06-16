import type { ReactNode } from 'react';
import { PublicBrandingProvider, PoweredByFooter } from '@/components/public-branding';

// (public) — the requester-facing surfaces (help center + hosted ticket
// form + tokenized ticket status). No auth, minimal chrome. The
// powered-by footer is context-gated: workspaces with hideBranding
// suppress it. Width is generous (max-w-3xl) for the help center; the
// form + status pages re-clamp themselves to max-w-xl.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PublicBrandingProvider>
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-12">
        {children}
        <PoweredByFooter />
      </main>
    </PublicBrandingProvider>
  );
}

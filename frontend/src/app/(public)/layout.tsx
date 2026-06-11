import type { ReactNode } from 'react';
import { PublicBrandingProvider, PoweredByFooter } from '@/components/public-branding';

// (public) — the requester-facing surfaces (hosted support form +
// tokenized ticket status). No auth, minimal chrome. The powered-by
// footer is context-gated: workspaces with hideBranding suppress it.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PublicBrandingProvider>
      <main className="mx-auto min-h-screen max-w-xl px-4 py-12">
        {children}
        <PoweredByFooter />
      </main>
    </PublicBrandingProvider>
  );
}

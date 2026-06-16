import type { ReactNode } from 'react';
import { PoweredByFooter } from '@/components/public-branding';

// Tokenized ticket-status subtree (/t/<token>/*). Restores the centered
// reading column + powered-by footer that used to live in the (public)
// root layout (now reserved so the portal can go full-bleed). These
// pages aren't account-scoped in the URL, so they stay on the default
// Suppuo palette — the hideBranding flag still flows via their own fetch.
export default function TokenLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {children}
      <PoweredByFooter />
    </main>
  );
}

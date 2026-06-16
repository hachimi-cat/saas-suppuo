import type { ReactNode } from 'react';
import { PublicBrandingProvider } from '@/components/public-branding';

// (public) — the requester-facing surfaces (help center + hosted ticket
// form + tokenized ticket status + the customer ticket portal). No auth,
// minimal chrome. This layer only provides the hideBranding context +
// a full-height canvas; each subtree sets its OWN width clamp + footer:
//   - support/[accountId]/* and t/* → centered reading column via their
//     own layouts (with the powered-by footer).
//   - portal/[accountId]/* → full-bleed buyer-portal Sidebar shell.
// Keeping the clamp out of here lets the portal go edge-to-edge while the
// help center stays a tidy max-w-3xl column — same split serront uses.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PublicBrandingProvider>
      <div className="min-h-screen bg-background">{children}</div>
    </PublicBrandingProvider>
  );
}

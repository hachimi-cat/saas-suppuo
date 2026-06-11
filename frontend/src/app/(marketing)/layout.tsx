import { Hexagon } from 'lucide-react';
import { MarketingShell, MarketingNav, MarketingFooter } from '@forjio/website-ui';

/*
 * Marketing route-group layout — the shared Forjio family chrome
 * (navbar + footer) wrapping every page rendered from content/*.md.
 *
 * After forking: swap <Hexagon> for your product's lucide icon and set
 * brandTagline to your one-liner. Everything else is family-locked —
 * the footer columns + legal entity come from @forjio/website-ui
 * defaults and should not be overridden.
 */
const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Forjio Brand';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <MarketingNav
        brandIcon={<Hexagon className="h-6 w-6 text-primary" />}
        brandName={brand}
      />
      <main className="flex-1">{children}</main>
      <MarketingFooter
        brandIcon={<Hexagon className="h-5 w-5 text-primary" />}
        brandName={brand}
        brandTagline={`${brand} — part of the Forjio family.`}
        copyrightSuffix="part of the Forjio family."
      />
    </MarketingShell>
  );
}

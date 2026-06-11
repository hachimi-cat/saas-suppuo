import { LogoMark } from '@/components/brand/logo';

import { MarketingShell, MarketingNav, MarketingFooter } from '@forjio/website-ui';

/*
 * Marketing route-group layout — the shared Forjio family chrome
 * (navbar + footer). The footer columns + legal entity come from
 * @forjio/website-ui defaults and should not be overridden.
 */
const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Suppuo';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <MarketingNav
        brandIcon={<LogoMark className="h-6 w-6 text-primary" />}
        brandName={brand}
      />
      <main className="flex-1">{children}</main>
      <MarketingFooter
        brandIcon={<LogoMark className="h-5 w-5 text-primary" />}
        brandName={brand}
        brandTagline={`${brand} — helpdesk and ticketing for Indonesian SMEs. Part of the Forjio family.`}
        copyrightSuffix="part of the Forjio family."
      />
    </MarketingShell>
  );
}

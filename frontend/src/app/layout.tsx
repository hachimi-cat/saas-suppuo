import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { gellix } from '@forjio/website-ui/fonts';
import '@forjio/website-ui/styles/marketing.css';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Suppuo';

// Geist Sans / Mono — the Forjio family body + mono faces. globals.css
// binds --font-sans / --font-mono to Geist's --font-geist-* vars.
// Gellix (family display face) ships from @forjio/website-ui/fonts.

export const metadata: Metadata = {
  title: { default: brand, template: `%s | ${brand}` },
  description: `${brand} — helpdesk and ticketing for Indonesian SMEs: support inbox, agent workspace, customer portal. Part of the Forjio family.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${gellix.variable} font-sans`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

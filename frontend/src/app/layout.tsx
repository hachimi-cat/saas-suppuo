import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { gellix } from '@forjio/website-ui/fonts';
import '@forjio/website-ui/styles/marketing.css';
import './globals.css';

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Suppuo';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: brand, template: `%s | ${brand}` },
  description: `${brand} — helpdesk and ticketing for Indonesian SMEs: support inbox, agent workspace, customer portal. Part of the Forjio family.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${gellix.variable} font-sans`}
      >
        {children}
      </body>
    </html>
  );
}

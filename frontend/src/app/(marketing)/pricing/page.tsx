import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

/*
 * Suppuo pricing — early access. There is exactly one plan today:
 * free, with everything included. Paid IDR tiers come later via
 * Plugipay; do NOT invent tier names or prices before they exist
 * in backend/src/config/plans.ts.
 */

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Suppuo is free during early access — every feature included, no card required. Paid plans in IDR are coming later.',
};

const included = [
  'Shared ticket inbox — statuses open / pending / resolved / closed',
  'Priorities + agent assignment',
  'Internal notes the requester never sees',
  'Canned replies for repeat questions',
  'Hosted ticket form — customers submit without an account',
  'Email updates + private tokenized status link for requesters',
  'Multi-workspace via Huudis SSO',
  'REST API (Bearer auth), webhooks via outbox, and the @forjio/suppuo-cli',
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Free during early access
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          One plan, everything included, no card required. We&apos;d rather you fix your
          support workflow first and pay us later.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-lg">
        <div className="relative rounded-xl border border-primary bg-card p-8 shadow-lg shadow-primary/10">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
            Early access
          </span>
          <h2 className="text-xl font-bold">Early access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For Indonesian SMEs moving support out of scattered WhatsApp threads and shared
            email accounts.
          </p>
          <p className="mt-6 text-4xl font-bold">
            Free
            <span className="ml-2 text-base font-normal text-muted-foreground">
              while in early access
            </span>
          </p>

          <ul className="mt-8 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground/90">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.25} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="mt-8 block rounded-md bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Start free
          </Link>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-card/60 p-5 text-sm leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Paid plans are coming.</p>
          <p className="mt-2">
            When early access ends, Suppuo will introduce paid plans billed in IDR through
            Plugipay — the Forjio family&apos;s billing spine — with USD via PayPal for
            international customers. Early-access workspaces will get clear notice before
            anything changes, and your tickets stay yours either way.
          </p>
          <p className="mt-2">
            Questions? <Link href="/contact" className="text-primary hover:underline">Talk to us</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

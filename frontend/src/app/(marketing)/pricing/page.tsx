import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';

/*
 * Suppuo pricing — per-WORKSPACE flat pricing (not per-agent). 4 tiers:
 * Gratis / Warung / Toko / Bisnis. During early access every paid tier
 * is free (all workspaces get Toko-level features); founding members get
 * 50% off for 12 months when billing starts, announced 30+ days ahead.
 *
 * The tier lists mirror backend/src/lib/billing.ts TIER_DEFS EXACTLY —
 * keep both in sync. The Suppuo platform WhatsApp number is awaiting
 * approval, so keep the "(beta)" badge on WA rows; BYO Twilio + BYO
 * Meta Cloud API work today. Do NOT invent features beyond this table
 * (no SLA, no reports page, no knowledge base, no white-label widget —
 * the widget's "Powered by Suppuo" is hardcoded).
 */

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Suppuo pricing — flat per-workspace plans in IDR, not per-agent. Free during early access; founding members get 50% off for 12 months when billing starts.',
};

type Tier = {
  name: string;
  price: string;
  period?: string;
  blurb: string;
  features: string[];
  earlyAccess: boolean;
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    name: 'Gratis',
    price: 'Rp 0',
    blurb: 'For trying Suppuo out, or a one-person support desk.',
    earlyAccess: false,
    features: [
      '2 agents',
      '100 tickets / month',
      'Inbox — tags, filters, full-text search',
      'Internal notes',
      '10 canned replies',
      'Hosted support form + status links (Suppuo branding)',
      'Live chat widget',
      'Email-to-ticket alias',
      'Email notifications',
      'File attachments up to 8MB',
      'Community support',
    ],
  },
  {
    name: 'Warung',
    price: 'Rp 99.000',
    period: '/bln',
    blurb: 'For small teams running real support every day.',
    earlyAccess: true,
    popular: true,
    features: [
      '3 agents',
      'Unlimited tickets + canned replies',
      'Hosted form + status links — no Suppuo branding',
      'WhatsApp channel (beta) — 1 number · 500 msgs/bln',
      'WA overage Rp 150/msg',
      'Telegram bot channel',
      'Slack + Discord team notifications',
      'CSAT surveys after resolve',
      'Auto-response + business hours (WIB)',
      'Email support',
    ],
  },
  {
    name: 'Toko',
    price: 'Rp 299.000',
    period: '/bln',
    blurb: 'For growing teams that want to build on the API.',
    earlyAccess: true,
    features: [
      '10 agents',
      'Everything in Warung',
      'WhatsApp channel (beta) — 1 number · 1.500 msgs/bln',
      'BYO WhatsApp Cloud API (Meta direct) = unlimited WA',
      'BYO email — your Resend account + domain',
      'REST API + CLI + webhooks',
      'Email support',
    ],
  },
  {
    name: 'Bisnis',
    price: 'Rp 599.000',
    period: '/bln',
    blurb: 'For bigger teams and multi-number WhatsApp support.',
    earlyAccess: true,
    features: [
      '25 agents',
      'Everything in Toko',
      'WhatsApp channel (beta) — 3 numbers · 4.000 msgs/bln',
      'BYO Twilio = unlimited WA messages',
      'Priority WhatsApp support',
    ],
  },
];

// Full feature comparison — mirrors the locked pricing model exactly.
type Row = { label: string; values: [string | boolean, string | boolean, string | boolean, string | boolean] };

const COMPARISON_ROWS: Row[] = [
  { label: 'Agents', values: ['2', '3', '10', '25'] },
  { label: 'Tickets / month', values: ['100', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Inbox — tags, filters, full-text search', values: [true, true, true, true] },
  { label: 'Priorities + assignment', values: [true, true, true, true] },
  { label: 'Internal notes', values: [true, true, true, true] },
  { label: 'Canned replies', values: ['10', 'Unlimited', 'Unlimited', 'Unlimited'] },
  {
    label: 'Hosted support form + status links',
    values: ['✓ Suppuo branding', '✓ No branding', true, true],
  },
  { label: 'Live chat widget', values: [true, true, true, true] },
  { label: 'Email-to-ticket alias', values: [true, true, true, true] },
  { label: 'Email notifications', values: [true, true, true, true] },
  { label: 'File attachments (8MB / file)', values: [true, true, true, true] },
  {
    label: 'WhatsApp channel (beta)',
    values: [false, '1 number · 500 msgs/bln', '1 number · 1.500 msgs/bln', '3 numbers · 4.000 msgs/bln'],
  },
  { label: 'WA overage', values: [false, 'Rp 150/msg', 'Rp 150/msg', 'Rp 150/msg'] },
  {
    label: 'BYO WhatsApp Cloud API (Meta direct)',
    values: [false, false, 'Unlimited WA', 'Unlimited WA'],
  },
  { label: 'BYO Twilio WhatsApp', values: [false, false, false, 'Unlimited WA'] },
  { label: 'Telegram bot channel', values: [false, true, true, true] },
  { label: 'Slack + Discord team notifications', values: [false, true, true, true] },
  { label: 'CSAT surveys after resolve', values: [false, true, true, true] },
  { label: 'Auto-response + business hours (WIB)', values: [false, true, true, true] },
  { label: 'BYO email (your Resend + domain)', values: [false, false, true, true] },
  { label: 'REST API + CLI + webhooks', values: [false, false, true, true] },
  { label: 'Support', values: ['Community', 'Email', 'Email', 'Priority WhatsApp'] },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          One flat price for the whole team.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Suppuo is priced per workspace, not per agent. Rp 99rb per bulan flat untuk
          seluruh tim — bukan Rp 400rb per orang seperti tool lain. Every plan includes
          the omnichannel inbox: hosted form, live chat widget, email-to-ticket, and more.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          During early access, every workspace gets Toko-level features free — no card
          required.
        </p>
      </div>

      {/* ── Tier grid ──────────────────────────────────────────────── */}
      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-xl border bg-card p-6 ${
              tier.popular
                ? 'border-primary shadow-lg shadow-primary/10'
                : 'border-border shadow-sm'
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                Most popular
              </span>
            )}
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{tier.name}</h2>
              {tier.earlyAccess && (
                <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Early Access — gratis
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{tier.blurb}</p>
            <p className="mt-5">
              <span className="text-3xl font-bold tabular-nums tracking-tight">{tier.price}</span>
              {tier.period && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">{tier.period}</span>
              )}
            </p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {tier.features.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px] leading-[1.45] text-foreground/90">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2.25} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={`mt-7 block rounded-md py-2.5 text-center text-sm font-medium transition-colors ${
                tier.popular
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'border border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              Start free
            </Link>
          </div>
        ))}
      </div>

      {/* ── Launch framing ─────────────────────────────────────────── */}
      <div className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-card/60 p-5 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Early access, honestly.</p>
        <p className="mt-2">
          While Suppuo is in early access, all workspaces get Toko-level features free.
          Founding members get 50% off for 12 months when billing starts (Warung Rp 49rb ·
          Toko Rp 149rb) — announced 30+ days in advance. If you don&apos;t pay later, you
          keep your data and drop to Gratis; export available on every tier.
        </p>
      </div>

      {/* ── Full comparison table ──────────────────────────────────── */}
      <div className="mx-auto mt-20 max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight">
          Compare plans in detail
        </h2>
        <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Feature
                </th>
                {TIERS.map((tier) => (
                  <th key={tier.name} className="px-4 py-3 text-center">
                    <span className={`font-semibold ${tier.popular ? 'text-primary' : 'text-foreground'}`}>
                      {tier.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                      {tier.price}
                      {tier.period ?? ''}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-foreground/90">{row.label}</td>
                  {row.values.map((value, i) => (
                    <ComparisonCell key={`${row.label}-${TIERS[i].name}`} value={value} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          The shared Suppuo WhatsApp number is awaiting WhatsApp approval — until it&apos;s
          live, WhatsApp works today by bringing your own number (Twilio on Bisnis, or
          Meta&apos;s Cloud API direct on Toko+), with unlimited messages through your own
          account. Email notifications are outbound updates to your requesters; connect
          your own Resend on Toko+ to send them from your domain.
        </p>
      </div>

      {/* ── Footer note ────────────────────────────────────────────── */}
      <div className="mx-auto mt-16 max-w-3xl rounded-lg border border-border bg-card/60 p-5 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Billing details.</p>
        <p className="mt-2">
          Paid plans are billed in IDR through Plugipay — the Forjio family&apos;s billing
          spine — with USD via PayPal for international customers. Your tickets stay yours
          on every tier, paid or not.
        </p>
        <p className="mt-2">
          Questions? <Link href="/contact" className="text-primary hover:underline">Talk to us</Link>.
        </p>
      </div>
    </div>
  );
}

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === 'string') {
    return (
      <td className="px-4 py-3 text-center text-[13px] text-foreground/80">{value}</td>
    );
  }
  return (
    <td className="px-4 py-3 text-center">
      {value ? (
        <Check className="mx-auto size-4 text-primary" strokeWidth={2.25} />
      ) : (
        <Minus className="mx-auto size-4 text-muted-foreground/40" strokeWidth={1.5} />
      )}
    </td>
  );
}

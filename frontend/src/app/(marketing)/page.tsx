import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Code2,
  Flag,
  Inbox,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  X as XIcon,
  Zap,
} from 'lucide-react';
import { HeroBadge, SectionEyebrow } from '@forjio/website-ui';

/*
 * Suppuo marketing home page — the locked Forjio 9-section structure
 * (Hero → How it works → Features → Pricing → Comparison → Developers →
 * Family → FAQ → CTA). linksnap.com is the family reference build.
 *
 * Copy is grounded in shipped Suppuo: six channels (hosted form, live
 * chat widget, email-to-ticket alias, WhatsApp via BYO Twilio/Meta
 * Cloud API, Telegram bot, manual logging), shared inbox with tags +
 * filters + full-text search, priorities + assignment, internal notes,
 * canned replies, auto-response + business hours (WIB), CSAT surveys,
 * file attachments (8MB), requester email updates + tokenized status
 * link, Slack/Discord team notifications, REST API + API keys +
 * webhooks + SDKs (Node/Python/Go) + CLI, multi-workspace via Huudis
 * SSO. FREE during early access. Tier lists mirror
 * backend/src/lib/billing.ts TIER_DEFS — keep in sync.
 */

export default function HomePage() {
  return (
    <>
      {/* ============================================================
          HERO
          ============================================================ */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Suppuo hero backdrop — off-axis radial + dot grid. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_20%,hsl(var(--primary)/0.18)_0%,transparent_50%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle,hsl(var(--border))_1px,transparent_1.5px)] [background-size:24px_24px] opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-14 md:pt-20 pb-12 md:pb-16">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
            <HeroBadge
              brandIcon={<LifeBuoy className="size-3 text-primary" strokeWidth={1.5} />}
              primary="Helpdesk + ticketing"
              secondary="Forjio family — free during early access"
            />

            <h1 className="mt-5 text-[36px] leading-[1.05] md:text-[56px] md:leading-[1.02] font-semibold tracking-[-0.025em]">
              Every customer question,
              <br />
              answered from{' '}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">one inbox</span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 h-3 md:h-4 bg-primary/60 dark:bg-primary/30 -z-0 rounded-sm"
                />
              </span>
              .
            </h1>

            <p className="mt-5 text-[15px] md:text-base leading-relaxed text-muted-foreground max-w-[60ch] mx-auto">
              Helpdesk and ticketing for Indonesian SMEs. Support form, live chat, email,
              WhatsApp, and Telegram all land in one searchable inbox — stop digging through
              chat threads to find who asked what. Free during early access. Part of the
              Forjio family.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Start free
                <ArrowRight className="size-4" strokeWidth={1.5} />
              </Link>
              <a
                href="#hero-mockup"
                className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg text-sm font-medium border border-border bg-card hover:bg-card/80 transition-colors backdrop-blur-sm"
              >
                See the inbox
              </a>
            </div>
          </div>

          <HeroInboxPreview />
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Channels in. Ticket worked. Customer updated.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">
              From sign-up to your first resolved ticket in minutes. No card — early access
              is free.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                num: '01',
                Icon: ClipboardList,
                title: 'Open your channels',
                body:
                  'Share your hosted support form, drop the live chat widget on your site with one script tag, forward support@ to your email-to-ticket alias, or connect WhatsApp and Telegram. Every channel lands in the same inbox.',
              },
              {
                num: '02',
                Icon: Users,
                title: 'Work it as a team',
                body:
                  'Assign an agent, set a priority, tag and search every ticket, discuss in internal notes the customer never sees, and answer repeat questions with canned replies. Auto-response covers you outside business hours.',
              },
              {
                num: '03',
                Icon: Mail,
                title: 'Customers stay in the loop',
                body:
                  'Requesters get an email on every reply and status change, plus a private status link to check progress anytime. After resolve, a one-click CSAT survey tells you how you did.',
              },
            ].map(({ num, Icon, title, body }) => (
              <div key={num} className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center size-8 rounded-md bg-primary/10 text-primary text-[12px] font-mono font-semibold">
                    {num}
                  </span>
                  <Icon className="size-4 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <SectionEyebrow>Features</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Everything a small support team needs.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">
              Six things Suppuo ships today — and during early access, all of them are free.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                Icon: Inbox,
                title: 'Six channels, one inbox',
                body:
                  'Hosted form, live chat widget, email-to-ticket, WhatsApp (beta), Telegram, and manual logging — every conversation lands in the same shared queue.',
              },
              {
                Icon: ClipboardList,
                title: 'Tags, filters + search',
                body:
                  'Tag every ticket, filter by status, priority, assignee, channel, or tag, and full-text search across subjects, requesters, and replies.',
              },
              {
                Icon: Flag,
                title: 'Priorities + assignment',
                body:
                  'Set a priority and assign each ticket to a teammate from the member picker. Urgent complaints stop sitting behind routine questions.',
              },
              {
                Icon: MessageSquareText,
                title: 'Notes, canned replies + attachments',
                body:
                  'Discuss privately in internal notes the requester never sees, reuse canned replies in two clicks, and attach files up to 8MB — WhatsApp photos included.',
              },
              {
                Icon: Sparkles,
                title: 'Automation + CSAT',
                body:
                  'Auto-respond to every new ticket — with a different reply outside your business hours (WIB) — and send a one-click CSAT survey after resolve.',
              },
              {
                Icon: Code2,
                title: 'API, webhooks, SDKs + CLI',
                body:
                  'A REST API with API keys, outbound webhooks via a transactional outbox, SDKs for Node.js, Python, and Go, and a CLI: npm i -g @forjio/suppuo-cli.',
              },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-6">
                <div className="size-10 rounded-md flex items-center justify-center bg-primary/10 text-primary mb-4">
                  <Icon className="size-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PRICING
          ============================================================ */}
      <section id="pricing" className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24">
          <div className="text-center max-w-3xl mx-auto">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              One flat price for the whole team.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[62ch] mx-auto">
              Per workspace, not per agent. Rp 99rb per bulan flat untuk seluruh tim — bukan
              Rp 400rb per orang seperti tool lain. And during early access, every workspace
              gets Toko-level features free.
            </p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-12 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-xl border bg-card p-6 flex flex-col ${
                  tier.popular
                    ? 'border-primary shadow-lg shadow-primary/5'
                    : 'border-border shadow-sm'
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-2.5 left-5 inline-flex items-center rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Most popular
                  </span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[17px] font-semibold tracking-tight">{tier.name}</h3>
                  {tier.earlyAccess && (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9.5px] font-semibold text-primary">
                      Early Access — gratis
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-[24px] font-bold tabular-nums tracking-tight">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-xs text-muted-foreground">{tier.period}</span>
                  )}
                </div>
                <ul className="mt-4 space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[12.5px] text-foreground/90 leading-[1.4]"
                    >
                      <Check className="size-3.5 mt-0.5 shrink-0 text-primary" strokeWidth={2.25} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex items-center justify-center w-full h-9 px-4 rounded-md text-sm font-medium transition-colors ${
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
          <p className="mt-6 text-[12.5px] text-muted-foreground text-center leading-relaxed max-w-3xl mx-auto">
            Founding members get 50% off for 12 months when billing starts (Warung Rp 49rb ·
            Toko Rp 149rb) — announced 30+ days in advance. If you don&apos;t pay later, you
            keep your data and drop to Gratis; export available on every tier.
          </p>
          <p className="mt-2 text-[12.5px] text-muted-foreground text-center leading-relaxed">
            Billed in IDR through Plugipay, USD via PayPal for international customers. See
            the{' '}
            <Link href="/pricing" className="text-primary hover:underline">
              full plan comparison
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ============================================================
          COMPARISON
          ============================================================ */}
      <section className="border-b border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="text-center max-w-2xl mx-auto">
            <SectionEyebrow>Compare</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Versus the way you do support today.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[60ch] mx-auto">
              Most Indonesian SMEs run support from a shared WhatsApp on the team phone — or
              pay for a per-agent helpdesk suite, where per-agent pricing multiplies with
              every person you add. Suppuo is flat per workspace: the whole team, one price.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto overflow-y-hidden -mx-4 md:mx-0 rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Capability
                  </th>
                  <th className="px-4 py-3 font-semibold text-primary">Suppuo</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Shared WhatsApp / email</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Per-agent helpdesk suites</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    cap: 'Pricing model',
                    s: 'Flat per workspace — from Rp 99rb/bln for the whole team',
                    a: 'Free',
                    b: 'Per agent — multiplies with team size',
                  },
                  { cap: 'Price today', s: 'Free (early access)', a: 'Free', b: 'Paid from agent #1' },
                  { cap: 'Ticket statuses + priorities', s: true, a: false, b: true },
                  { cap: 'Assignment + internal notes', s: true, a: false, b: true },
                  { cap: 'Tags + full-text search', s: true, a: false, b: true },
                  { cap: 'Customer status link, no login', s: true, a: false, b: 'Varies' },
                  { cap: 'Canned replies + auto-response', s: true, a: false, b: true },
                  { cap: 'Live chat + email-to-ticket + Telegram', s: true, a: false, b: 'Often add-ons' },
                  { cap: 'WhatsApp as a channel', s: 'Built in (beta)', a: 'It IS the channel — and the chaos', b: 'Often an add-on' },
                  { cap: 'CSAT surveys', s: true, a: false, b: true },
                  { cap: 'One login for sister products', s: true, a: false, b: false },
                ].map((row) => (
                  <tr key={row.cap} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-foreground/90">{row.cap}</td>
                    <Cell value={row.s} highlight />
                    <Cell value={row.a} />
                    <Cell value={row.b} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOR DEVELOPERS
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
            <div>
              <SectionEyebrow>For developers</SectionEyebrow>
              <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
                A REST API, webhooks, and a real CLI.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">
                Suppuo is built API-first. Everything the dashboard does goes through the same
                REST API you can call yourself — wire support into your own stack without glue.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'REST API with API keys (Bearer-token auth)',
                  'Consistent response envelope with request IDs on every call',
                  'Outbound webhooks delivered via a transactional outbox — state changes never skip an event',
                  'SDKs for Node.js, Python, and Go',
                  'CLI on npm: @forjio/suppuo-cli — log in with your Forjio account',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed">
                    <Check className="size-4 mt-0.5 shrink-0 text-primary" strokeWidth={2.25} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Read the docs
                  <ArrowRight className="size-4" strokeWidth={1.5} />
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <TerminalCard label="suppuo">
                <span className="text-white/40"># Install once</span>
                {'\n'}
                <span className="text-white/90">$ npm i -g @forjio/suppuo-cli</span>
                {'\n\n'}
                <span className="text-white/40"># Log in with your Forjio account</span>
                {'\n'}
                <span className="text-white/90">$ suppuo auth login</span>
                {'\n'}
                <span className="text-green-300">✔ Authenticated as you@example.com via Huudis</span>
                {'\n\n'}
                <span className="text-white/90">$ suppuo auth whoami</span>
                {'\n'}
                <span className="text-green-300">✔ you@example.com</span>
              </TerminalCard>

              <TerminalCard label="response.json">
                <span className="text-white/40">{'// Every endpoint, same envelope'}</span>
                {'\n'}
                <span className="text-white/90">{'{'}</span>
                {'\n'}
                <span className="text-white/90">{'  "data": { '}</span>
                <span className="text-green-300">{'"status": "open"'}</span>
                <span className="text-white/90">{', … },'}</span>
                {'\n'}
                <span className="text-white/90">{'  "error": '}</span>
                <span className="text-purple-300">null</span>
                <span className="text-white/90">,</span>
                {'\n'}
                <span className="text-white/90">{'  "meta": {'}</span>
                {'\n'}
                <span className="text-white/90">{'    "requestId": '}</span>
                <span className="text-green-300">{'"req_…"'}</span>
                <span className="text-white/90">,</span>
                {'\n'}
                <span className="text-white/90">{'    "timestamp": '}</span>
                <span className="text-green-300">{'"2026-06-11T09:00:00Z"'}</span>
                {'\n'}
                <span className="text-white/90">{'  }'}</span>
                {'\n'}
                <span className="text-white/90">{'}'}</span>
              </TerminalCard>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FORJIO FAMILY
          ============================================================ */}
      <section className="border-b border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <SectionEyebrow>One login</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Sign in once. Use every Forjio product.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[60ch] mx-auto">
              Suppuo shares its account system with the rest of the Forjio family through
              Huudis SSO. Add a teammate here and they&apos;re already part of your other
              Forjio workspaces.
            </p>
          </div>

          <div className="mt-12 max-w-2xl mx-auto">
            <div className="rounded-xl border border-border bg-card shadow-sm p-8">
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-2">
                  <ShieldCheck className="size-7" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-foreground">Huudis</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">identity</p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {[
                  { name: 'Suppuo', icon: LifeBuoy, current: true, label: 'helpdesk' },
                  { name: 'Storlaunch', icon: Zap, label: 'storefront' },
                  { name: 'Plugipay', icon: CircleDollarSign, label: 'payments' },
                  { name: 'Fulkruma', icon: Boxes, label: 'fulfillment' },
                  { name: 'Ripllo', icon: Megaphone, label: 'marketing' },
                  { name: 'Catentio', icon: Sparkles, label: 'agents' },
                ].map((p) => (
                  <div
                    key={p.name}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 ${
                      p.current
                        ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-card/40'
                    }`}
                  >
                    <p.icon
                      className={`size-5 ${p.current ? 'text-primary' : 'text-muted-foreground'}`}
                      strokeWidth={1.5}
                    />
                    <span className="text-[10.5px] font-medium leading-tight text-center">{p.name}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight text-center">
                      {p.label}
                    </span>
                    {p.current && (
                      <span className="text-[9px] font-mono text-primary">you are here</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-6 text-sm text-muted-foreground text-center">
              Powered by{' '}
              <a href="https://huudis.com" className="text-primary hover:underline font-medium">
                Huudis
              </a>{' '}
              — the identity provider for the Forjio family.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          FAQ
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Common questions.
            </h2>
          </div>

          <ul className="mt-10 divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
            {[
              {
                q: 'Is early access really free?',
                a: 'Yes. During early access, every workspace gets Toko-level features free — no card, no trial countdown. When billing starts (announced 30+ days in advance), founding members get 50% off for 12 months: Warung Rp 49rb, Toko Rp 149rb per bulan.',
              },
              {
                q: 'Why per workspace instead of per agent?',
                a: 'Because per-agent pricing punishes you for growing your team. Most helpdesk suites charge per agent per month, so the bill multiplies with every hire. Suppuo is flat per workspace: Warung is Rp 99rb per bulan for the whole team, whether one agent answers or three.',
              },
              {
                q: 'What happens if I don’t pay when billing starts?',
                a: 'You keep your data and your workspace drops to the Gratis tier (2 agents, 100 tickets/month). Export is available on every tier, paid or not — no bait-and-switch, no data hostage.',
              },
              {
                q: 'How does the WhatsApp channel work?',
                a: 'Customer WhatsApp chats become tickets in your shared inbox, photos and media included, and agent replies go back to the chat. The shared Suppuo number is awaiting WhatsApp approval — until it’s live, connect your own number today: your own Twilio account (Bisnis) or Meta’s WhatsApp Cloud API direct (Toko and up), both with unlimited messages through your own account. Platform-number tiers include a monthly allowance; beyond it, messages are Rp 150 each.',
              },
              {
                q: 'Do my customers need an account to submit or track a ticket?',
                a: 'No. They reach you through your hosted form, the live chat widget on your site, email, WhatsApp, or Telegram — then get an email on every reply and status change plus a private, tokenized status link to check progress. No login required, ever.',
              },
              {
                q: 'Can customers email us a ticket instead of using the form?',
                a: 'Yes. Every workspace gets an inbound address — forward your support@ to it and every email becomes a ticket, with replies threading both ways. The form, live chat widget, WhatsApp (beta), Telegram, and manual logging all land in the same inbox.',
              },
              {
                q: 'What about SLAs, reports, or a knowledge base?',
                a: 'Not shipped yet, and we won’t pretend otherwise. What HAS shipped: auto-response with business hours (WIB), one-click CSAT surveys after resolve with a satisfaction average on your dashboard, tags, and full-text search. SLAs, deeper reporting, and a knowledge base are on the roadmap.',
              },
              {
                q: 'How do agents work together on a ticket?',
                a: 'Every ticket lives in a shared inbox with a status (open, pending, resolved, closed), a priority, tags, and an assignee picked from your workspace members. Agents discuss privately in internal notes the requester never sees, answer repeat questions with canned replies, attach files up to 8MB, and find anything with full-text search. New tickets and customer replies can also ping your team in Slack or Discord.',
              },
              {
                q: 'Can I run support for more than one brand or team?',
                a: 'Yes. Suppuo is multi-workspace via Huudis SSO — one Forjio login, separate workspaces with their own inboxes, forms, and members.',
              },
              {
                q: 'Who owns my support data?',
                a: 'You do. Tickets belong to your workspace, and you can fetch everything through the REST API. Forjio never sells or repackages your data.',
              },
            ].map((faq) => (
              <li key={faq.q}>
                <details className="group">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-6 py-5 hover:bg-muted/30 transition-colors [&::-webkit-details-marker]:hidden">
                    <span className="text-[15px] font-medium text-foreground">{faq.q}</span>
                    <ChevronDown
                      className="size-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0"
                      strokeWidth={1.5}
                    />
                  </summary>
                  <div className="px-6 pb-5 -mt-1 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
          FOOTER CTA
          ============================================================ */}
      <section className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 md:py-20 text-center">
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary mb-6">
              <LifeBuoy className="size-6" strokeWidth={2} />
            </div>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em] max-w-[24ch]">
              Set up your support inbox today.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[52ch]">
              Free during early access. No card — there&apos;s nothing to charge yet.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Start free
                <ArrowRight className="size-4" strokeWidth={1.5} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-medium border border-border bg-card hover:bg-muted transition-colors"
              >
                Talk to a human
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

// Per-WORKSPACE flat pricing — the whole team, one price. Source of
// truth is backend/src/lib/billing.ts TIER_DEFS (condensed here);
// /pricing has the full comparison table. WhatsApp rows stay "(beta)"
// while the platform number awaits approval — BYO works today.
const PRICING_TIERS = [
  {
    name: 'Gratis',
    price: 'Rp 0',
    period: undefined,
    earlyAccess: false,
    popular: false,
    features: [
      '2 agents · 100 tickets / month',
      'Inbox — tags, filters, full-text search',
      'Internal notes + 10 canned replies',
      'Hosted form, live chat widget, email-to-ticket',
      'File attachments up to 8MB',
      'Community support',
    ],
  },
  {
    name: 'Warung',
    price: 'Rp 99.000',
    period: '/bln',
    earlyAccess: true,
    popular: true,
    features: [
      '3 agents · unlimited tickets + canned replies',
      'No Suppuo branding on your form',
      'WhatsApp (beta) — 1 number · 500 msgs/bln',
      'Telegram bot + Slack/Discord notifications',
      'CSAT surveys + auto-response with business hours',
      'Email support',
    ],
  },
  {
    name: 'Toko',
    price: 'Rp 299.000',
    period: '/bln',
    earlyAccess: true,
    popular: false,
    features: [
      '10 agents · everything in Warung',
      'WhatsApp (beta) — 1 number · 1.500 msgs/bln',
      'BYO WhatsApp Cloud API = unlimited WA',
      'BYO email — your Resend + domain',
      'REST API + CLI + webhooks',
      'Email support',
    ],
  },
  {
    name: 'Bisnis',
    price: 'Rp 599.000',
    period: '/bln',
    earlyAccess: true,
    popular: false,
    features: [
      '25 agents · everything in Toko',
      'WhatsApp (beta) — 3 numbers · 4.000 msgs/bln',
      'BYO Twilio = unlimited WA messages',
      'Priority WhatsApp support',
    ],
  },
] as const;

function Cell({ value, highlight }: { value: boolean | string; highlight?: boolean }) {
  if (typeof value === 'string') {
    return (
      <td
        className={`px-4 py-3 text-center text-[13px] ${
          highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'
        }`}
      >
        {value}
      </td>
    );
  }
  return (
    <td className="px-4 py-3 text-center">
      {value ? (
        <Check
          className={`size-4 mx-auto ${highlight ? 'text-primary' : 'text-foreground/60'}`}
          strokeWidth={2.25}
        />
      ) : (
        <XIcon className="size-4 mx-auto text-muted-foreground/40" strokeWidth={1.5} />
      )}
    </td>
  );
}

// Hero mockup — the Suppuo shared inbox, built from plain styled divs.
// Sample tickets only; no real names, credentials, or tokens.
const HERO_TICKETS = [
  {
    id: '#1042',
    subject: 'Pesanan belum sampai, resi tidak update',
    requester: 'Rina W.',
    status: 'open',
    priority: 'urgent',
    assignee: 'DA',
  },
  {
    id: '#1041',
    subject: 'How do I change my delivery address?',
    requester: 'Budi S.',
    status: 'pending',
    priority: 'normal',
    assignee: 'AY',
  },
  {
    id: '#1040',
    subject: 'Refund for double payment',
    requester: 'Sari L.',
    status: 'open',
    priority: 'high',
    assignee: '—',
  },
  {
    id: '#1038',
    subject: 'Terima kasih, sudah diterima!',
    requester: 'Andi P.',
    status: 'resolved',
    priority: 'low',
    assignee: 'DA',
  },
] as const;

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-primary/10 text-primary border-primary/30',
  pending: 'bg-amber-400/10 text-amber-500 border-amber-400/30',
  resolved: 'bg-emerald-400/10 text-emerald-500 border-emerald-400/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

function HeroInboxPreview() {
  return (
    <div id="hero-mockup" className="mt-12 md:mt-14 max-w-2xl mx-auto">
      <div className="rounded-xl border border-border bg-card shadow-lg shadow-primary/5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-500/70" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-primary/70" />
            <LifeBuoy className="ml-2 size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[11px] text-muted-foreground font-mono">
              suppuo.com / dashboard / tickets
            </span>
          </div>
          <MoreHorizontal className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <Inbox className="size-4 text-primary" strokeWidth={1.5} />
            <p className="text-[13px] font-semibold text-foreground">Support inbox</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] font-mono">
            <span className="rounded-md border border-primary/30 bg-primary/10 text-primary px-2 py-0.5">
              open 2
            </span>
            <span className="rounded-md border border-border text-muted-foreground px-2 py-0.5">
              pending 1
            </span>
            <span className="rounded-md border border-border text-muted-foreground px-2 py-0.5">
              resolved 1
            </span>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {HERO_TICKETS.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-[10.5px] font-mono text-muted-foreground shrink-0">{t.id}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-foreground truncate">{t.subject}</p>
                <p className="text-[10.5px] text-muted-foreground truncate">
                  {t.requester} · {t.priority} priority
                </p>
              </div>
              <span
                className={`hidden sm:inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9.5px] font-mono ${STATUS_STYLES[t.status]}`}
              >
                {t.status}
              </span>
              <span className="shrink-0 inline-flex items-center justify-center size-6 rounded-full bg-muted text-[9.5px] font-semibold text-muted-foreground">
                {t.assignee}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted-foreground text-center">
        The shared inbox — statuses, priorities, and assignment at a glance.
      </p>
    </div>
  );
}

function TerminalCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-px rounded-xl bg-gradient-to-br from-primary/20 via-transparent to-transparent dark:from-primary/10 blur-sm"
      />
      <div className="relative rounded-xl border border-slate-900/90 bg-[#0B0F1A] shadow-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-3.5 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-primary/80" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono">
            <Terminal className="size-3 text-primary" strokeWidth={1.5} />
            {label}
          </div>
          <span className="text-[11px] text-white/30 font-mono">zsh</span>
        </div>
        <pre className="px-4 py-4 text-[12px] leading-[1.7] font-mono whitespace-pre-wrap break-words">
          {children}
        </pre>
      </div>
    </div>
  );
}

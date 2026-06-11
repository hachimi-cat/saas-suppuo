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
  Link2,
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
 * Copy is grounded in Suppuo v1: hosted ticket form, shared agent inbox
 * (statuses open/pending/resolved/closed, priorities, assignment,
 * internal notes, canned replies), requester email updates + tokenized
 * status link, multi-workspace via Huudis SSO. FREE during early access.
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
              Helpdesk and ticketing for Indonesian SMEs — support inbox, agent workspace,
              customer portal. Stop digging through WhatsApp threads to find who asked what.
              Free during early access. Part of the Forjio family.
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
              Form in. Ticket worked. Customer updated.
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
                title: 'Share your ticket form',
                body:
                  'Every workspace gets a hosted support form. Put the link on your website, your bio page, or your WhatsApp auto-reply. Customers submit a ticket in seconds — no account needed.',
              },
              {
                num: '02',
                Icon: Users,
                title: 'Work it as a team',
                body:
                  'Tickets land in one shared inbox. Assign an agent, set a priority, discuss in internal notes the customer never sees, and answer repeat questions with canned replies.',
              },
              {
                num: '03',
                Icon: Mail,
                title: 'Customers stay in the loop',
                body:
                  'Requesters get an email on every reply and status change, plus a private status link to check progress anytime. No more “sudah dibalas belum?” follow-ups.',
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
                title: 'Shared ticket inbox',
                body:
                  'One queue for the whole team. Every ticket moves through open → pending → resolved → closed, so you always know what still needs an answer.',
              },
              {
                Icon: Flag,
                title: 'Priorities + assignment',
                body:
                  'Set a priority and assign each ticket to an agent. Urgent complaints stop sitting behind routine questions, and nothing is “someone else’s problem”.',
              },
              {
                Icon: MessageSquareText,
                title: 'Internal notes + canned replies',
                body:
                  'Discuss a ticket privately in internal notes the requester never sees. Save your best answers as canned replies and reuse them in two clicks.',
              },
              {
                Icon: ClipboardList,
                title: 'Hosted ticket form',
                body:
                  'A ready-made support form at a link you can share anywhere. Customers submit without creating an account; the ticket appears in your inbox instantly.',
              },
              {
                Icon: Link2,
                title: 'Status link + email updates',
                body:
                  'Every requester gets a private, tokenized status link and an email on each reply or status change — they stay informed without logging in.',
              },
              {
                Icon: Code2,
                title: 'API + CLI',
                body:
                  'A REST API with Bearer-token auth, webhooks delivered via a transactional outbox, and a CLI: npm i -g @forjio/suppuo-cli.',
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
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-16 md:pt-24">
          <div className="text-center max-w-3xl mx-auto">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Free during early access. Really.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[62ch] mx-auto">
              While Suppuo is in early access, every feature is free — no card, no trial
              clock. Paid plans in IDR are coming later; early-access workspaces will get
              clear notice before anything changes.
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-12 pb-16">
          <div className="max-w-md mx-auto">
            <div className="relative rounded-xl border border-primary bg-card shadow-lg shadow-primary/5 p-6 flex flex-col">
              <span className="absolute -top-2.5 left-5 inline-flex items-center rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Early access
              </span>
              <h3 className="text-[18px] font-semibold tracking-tight">Early access</h3>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-snug">
                For Indonesian SMEs getting their support out of scattered chats.
              </p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[28px] font-bold tabular-nums tracking-tight">Free</span>
                <span className="text-xs text-muted-foreground">while in early access</span>
              </div>
              <ul className="mt-5 space-y-2 flex-1">
                {[
                  'Shared ticket inbox — statuses, priorities, assignment',
                  'Hosted ticket form for your customers',
                  'Internal notes + canned replies',
                  'Email updates + private status link for requesters',
                  'Multi-workspace via Huudis SSO',
                  'REST API, webhooks, and the Suppuo CLI',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-foreground/90 leading-[1.4]">
                    <Check className="size-3.5 mt-0.5 shrink-0 text-primary" strokeWidth={2.25} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-6 inline-flex items-center justify-center w-full h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors"
              >
                Start free
              </Link>
            </div>
            <p className="mt-5 text-[12.5px] text-muted-foreground text-center leading-relaxed">
              Paid plans are coming — billed in IDR through Plugipay, with USD via PayPal for
              international customers. See{' '}
              <Link href="/pricing" className="text-primary hover:underline">
                pricing
              </Link>{' '}
              for details.
            </p>
          </div>
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
              Most Indonesian SMEs run support out of a shared WhatsApp or email account — or
              pay for an enterprise helpdesk priced in USD per agent.
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
                  <th className="px-4 py-3 font-medium text-muted-foreground">Enterprise helpdesks</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { cap: 'Price today', s: 'Free (early access)', a: 'Free', b: 'USD, per agent / mo' },
                  { cap: 'Ticket statuses + priorities', s: true, a: false, b: true },
                  { cap: 'Assignment + internal notes', s: true, a: false, b: true },
                  { cap: 'Customer status link, no login', s: true, a: false, b: 'Varies' },
                  { cap: 'Canned replies', s: true, a: false, b: true },
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
                  'REST API with Bearer-token auth',
                  'Consistent response envelope with request IDs on every call',
                  'Webhooks delivered via a transactional outbox — state changes never skip an event',
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
                a: 'Yes. While Suppuo is in early access, every feature is free — no card, no trial countdown. Paid plans in IDR (billed through Plugipay, USD via PayPal for international customers) are coming later, and early-access workspaces will get clear notice before anything changes.',
              },
              {
                q: 'Do my customers need an account to submit or track a ticket?',
                a: 'No. They submit through your hosted ticket form, then get an email on every reply and status change plus a private, tokenized status link to check progress — no login required.',
              },
              {
                q: 'Can customers email us a ticket instead of using the form?',
                a: 'In v1, tickets come in through your hosted form. Email-to-ticket is next on the list — and requesters already receive every update by email today.',
              },
              {
                q: 'How do agents work together on a ticket?',
                a: 'Every ticket lives in a shared inbox with a status (open, pending, resolved, closed), a priority, and an assignee. Agents discuss privately in internal notes the requester never sees, and answer repeat questions with canned replies.',
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

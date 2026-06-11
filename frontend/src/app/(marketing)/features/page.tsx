import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Inbox,
  Flag,
  MessageSquareText,
  ClipboardList,
  Link2,
  Code2,
  ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Everything Suppuo ships — shared ticket inbox, priorities and assignment, internal notes, canned replies, a hosted ticket form, requester status links, and an API + CLI.',
};

const features = [
  {
    Icon: Inbox,
    title: 'Shared ticket inbox',
    body: 'One queue for the whole team, so support stops living in someone’s personal chat history.',
    details: [
      'Statuses: open → pending → resolved → closed',
      'Filter by status, priority, and assignee',
      'Full ticket thread — every reply in one place',
      'Multi-workspace: separate inboxes per brand or team',
    ],
  },
  {
    Icon: Flag,
    title: 'Priorities + assignment',
    body: 'Route each ticket to the right agent and make urgency visible, so complaints don’t sit behind routine questions.',
    details: [
      'Assign tickets to a specific agent',
      'Per-ticket priority levels',
      'Unassigned tickets are visible to everyone — nothing falls through',
      'Reassign anytime as the ticket evolves',
    ],
  },
  {
    Icon: MessageSquareText,
    title: 'Internal notes + canned replies',
    body: 'Collaborate on the ticket itself, and stop retyping the same answer ten times a day.',
    details: [
      'Internal notes the requester never sees',
      'Notes live in the ticket thread, next to the replies',
      'Save canned replies for repeat questions',
      'Insert a canned reply in two clicks, then personalize',
    ],
  },
  {
    Icon: ClipboardList,
    title: 'Hosted ticket form',
    body: 'A ready-made support form at a link you can share anywhere — your site, bio page, or WhatsApp auto-reply.',
    details: [
      'No customer account required to submit',
      'Tickets appear in your inbox instantly',
      'One form per workspace, ready on day one',
      'Email-to-ticket is next on the roadmap',
    ],
  },
  {
    Icon: Link2,
    title: 'Status link + email updates',
    body: 'Requesters always know where their ticket stands — without logging in or asking again.',
    details: [
      'Private, tokenized status link per ticket',
      'Email on every agent reply',
      'Email on every status change',
      'No login or password for your customers, ever',
    ],
  },
  {
    Icon: Code2,
    title: 'API + CLI',
    body: 'Suppuo is built API-first — the dashboard and your scripts use the same REST API.',
    details: [
      'REST API with Bearer-token auth',
      'Consistent response envelope + request IDs',
      'Webhooks delivered via a transactional outbox',
      'CLI on npm: @forjio/suppuo-cli',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Everything a small support team needs.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Suppuo is a helpdesk for Indonesian SMEs: customers submit tickets through a hosted
          form, agents work them in a shared inbox, and requesters stay updated by email and a
          private status link. During early access, all of it is free.
        </p>
      </div>

      <div className="mt-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.map(({ Icon, title, body, details }) => (
            <article key={title} className="rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-6" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.01em]">{title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {details.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Free during early access — no card required.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Every feature above is included while Suppuo is in early access. Paid plans in IDR
          come later, with clear notice first.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start free <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent"
          >
            View pricing
          </Link>
        </div>
      </div>
    </div>
  );
}

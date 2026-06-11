import type { Metadata } from 'next';
import { LifeBuoy } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Suppuo is a helpdesk and ticketing product for Indonesian SMEs, built by the Forjio team.',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">About Suppuo</h1>
        </div>

        <div className="mt-10 space-y-6 text-muted-foreground">
          <p className="text-lg">
            Suppuo exists because most Indonesian SMEs still run customer support out of a
            shared WhatsApp account — and good customers get lost in the scroll.
          </p>

          <p>
            When support lives in a chat thread, there is no status, no owner, and no record.
            Whoever holds the phone answers what they happen to see; everything else quietly
            expires. The enterprise helpdesks that solve this are priced in USD per agent and
            built for support departments, not for a small online shop with three people wearing
            every hat.
          </p>

          <p>
            Suppuo is a helpdesk in plain terms: your customers submit tickets through a
            hosted form, your team works them in a shared inbox — statuses, priorities,
            assignment, internal notes, canned replies — and every requester gets email
            updates plus a private status link to check progress without logging in. It does
            the one thing chat apps can&apos;t: make sure every question has an owner and an
            answer.
          </p>

          <h2 className="pt-4 text-2xl font-bold text-foreground">Our principles</h2>

          <ul className="space-y-4">
            <li>
              <strong className="text-foreground">Every ticket has an owner.</strong>{' '}
              The whole product is organized around assignment and status — a question that
              isn&apos;t resolved or closed is visibly someone&apos;s job.
            </li>
            <li>
              <strong className="text-foreground">Zero friction for your customers.</strong>{' '}
              No accounts, no passwords, no app to install. A form to submit, an email when
              something happens, and a private link to check status.
            </li>
            <li>
              <strong className="text-foreground">No vendor lock-in.</strong>{' '}
              Your tickets are yours — fetch everything through the REST API anytime.
            </li>
            <li>
              <strong className="text-foreground">Honest pricing.</strong>{' '}
              Suppuo is free during early access — no card, no trial countdown. When paid
              plans arrive they&apos;ll be priced in IDR, with clear notice first.
            </li>
          </ul>

          <h2 className="pt-4 text-2xl font-bold text-foreground">Built by Forjio</h2>

          <p>
            Suppuo is built and maintained by the Forjio team — a family of products
            that share one identity layer (Huudis) and one billing spine (Plugipay). Sign
            up once, work across all of them.
          </p>

          <p>
            Questions? Reach us at{' '}
            <span className="font-mono text-primary">support@forjio.com</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

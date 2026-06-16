'use client';

/*
 * Hosted HELP CENTER (/support/<accountId>) — the public front door a
 * workspace shares with its customers. Sections (all gated on having
 * content):
 *   🔎 Search    — keyword search over published FAQ + articles
 *                  (the Catentio AI swaps in behind this later)
 *   ❓ FAQ        — published FAQ, grouped by category
 *   📄 Articles   — published articles + a deep-link to the PRODUCT's
 *                  own /docs when the workspace configured one
 *   📍 Contact    — Suppuo contact profile, or the product's /contact
 *   💬 Live chat  — the Suppuo widget bubble (loaded here) + a CTA
 *   ✍️  Submit     — the ticket form (/support/<acc>/new) — "talk to a human"
 *
 * Everything rides the unauthenticated /public/help read API.
 */

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import {
  Search,
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  FileText,
  BookOpen,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Ticket,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useSetHideBranding } from '@/components/public-branding';
import { EMPTY_BRANDING, type PublicBranding } from '@/lib/theme';

interface Faq {
  id: string;
  category: string | null;
  question: string;
  answer: string;
}
interface ArticleCard {
  id: string;
  slug: string | null;
  category: string | null;
  title: string;
  excerpt: string;
}
interface Contact {
  email: string | null;
  phone: string | null;
  address: string | null;
  contactUrl: string | null;
  docsUrl: string | null;
}
interface Bundle {
  contact: Contact;
  intro: string | null;
  hideBranding: boolean;
  branding: PublicBranding;
  faqs: Faq[];
  articles: ArticleCard[];
  docs: ArticleCard[];
}
interface SearchHit {
  id: string;
  kind: string;
  slug: string | null;
  category: string | null;
  title: string;
  excerpt: string;
}

export default function HelpCenterPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const setHideBranding = useSetHideBranding();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiRequest<Bundle>(`/public/help/${accountId}`)
      .then(({ data }) => {
        setBundle(data);
        if (data.hideBranding) setHideBranding(true);
      })
      .catch(() =>
        setBundle({
          contact: emptyContact(),
          intro: null,
          hideBranding: false,
          branding: EMPTY_BRANDING,
          faqs: [],
          articles: [],
          docs: [],
        }),
      );
  }, [accountId, setHideBranding]);

  const runSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setHits(null);
        return;
      }
      setSearching(true);
      apiRequest<{ query: string; hits: SearchHit[] }>(
        `/public/help/${accountId}/search?q=${encodeURIComponent(q)}`,
      )
        .then(({ data }) => setHits(data.hits))
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    },
    [accountId],
  );

  function onQuery(v: string) {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(v), 250);
  }

  function openLiveChat() {
    const w = window as unknown as { Suppuo?: { open?: () => void } };
    w.Suppuo?.open?.();
  }

  if (!bundle) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const { contact, faqs, articles, docs } = bundle;
  const branding = bundle.branding ?? EMPTY_BRANDING;
  const hasContact = Boolean(contact.email || contact.phone || contact.address || contact.contactUrl);

  return (
    <div>
      {/* Live-chat widget — mounts the bottom-right bubble on this page. */}
      <Script
        src="/widget.js"
        data-suppuo-account={accountId}
        data-suppuo-accent={branding.accentColor ?? ''}
        strategy="afterInteractive"
      />

      {/* ── Hero + search ─────────────────────────────────────────── */}
      {/* No logo here — the header already carries it. */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">How can we help?</h1>
        {bundle.intro && (
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{bundle.intro}</p>
        )}
        <div className="relative mx-auto mt-6 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search for answers…"
            className="w-full rounded-xl border border-border bg-card py-3.5 pl-12 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* ── Search results (replaces the browse view while searching) ── */}
      {hits !== null ? (
        <div className="mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {searching ? 'Searching…' : `${hits.length} result${hits.length === 1 ? '' : 's'} for “${query}”`}
          </p>
          {hits.length === 0 && !searching ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No answers found. Try different words, or reach a human below.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={openLiveChat}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle className="size-4" /> Live chat
                </button>
                <Link
                  href={`/support/${accountId}/new`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Submit a request
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {hits.map((h) => (
                <li key={h.id}>
                  <HitRow accountId={accountId} hit={h} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* ── FAQ ─────────────────────────────────────────────────── */}
          {faqs.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold tracking-tight">Frequently asked questions</h2>
              <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {faqs.map((f) => (
                  <FaqRow key={f.id} faq={f} />
                ))}
              </div>
            </section>
          )}

          {/* ── Articles + product docs ─────────────────────────────── */}
          {(articles.length > 0 || contact.docsUrl) && (
            <section className="mt-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Guides &amp; articles</h2>
                {contact.docsUrl && (
                  <a
                    href={contact.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <BookOpen className="size-4" /> Full documentation
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              {articles.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {articles.map((a) => (
                    <Link
                      key={a.id}
                      href={`/support/${accountId}/a/${a.slug}`}
                      className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          {a.category && (
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {a.category}
                            </p>
                          )}
                          <p className="font-medium leading-snug group-hover:text-primary">{a.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Documentation (ingested from the product's own docs) ──── */}
          {docs.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold tracking-tight">Documentation</h2>
              <div className="mt-4 space-y-5">
                {groupByCategory(docs).map(([cat, items]) => (
                  <div key={cat || '_'}>
                    {cat && (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {cat}
                      </p>
                    )}
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {items.map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/support/${accountId}/a/${d.slug}`}
                            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
                          >
                            <FileText className="size-4 shrink-0 text-primary" />
                            <span className="truncate">{d.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Still need help: live chat + ticket ─────────────────── */}
          <section className="mt-10 grid gap-3 sm:grid-cols-2">
            <button
              onClick={openLiveChat}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="size-5" />
              </span>
              <span>
                <span className="block font-medium">Live chat</span>
                <span className="block text-sm text-muted-foreground">Chat with us now</span>
              </span>
            </button>
            <Link
              href={`/support/${accountId}/new`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ArrowRight className="size-5" />
              </span>
              <span>
                <span className="block font-medium">Submit a request</span>
                <span className="block text-sm text-muted-foreground">We&apos;ll reply by email</span>
              </span>
            </Link>
            <Link
              href={`/portal/${accountId}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary sm:col-span-2"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Ticket className="size-5" />
              </span>
              <span>
                <span className="block font-medium">Track your tickets</span>
                <span className="block text-sm text-muted-foreground">
                  Sign in to view and reply to your past requests
                </span>
              </span>
            </Link>
          </section>

          {/* ── Contact ─────────────────────────────────────────────── */}
          {hasContact && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold tracking-tight">Contact us</h2>
              <div className="mt-4 space-y-2.5 rounded-xl border border-border bg-card p-5 text-sm">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground">
                    <Mail className="size-4 text-primary" /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground">
                    <Phone className="size-4 text-primary" /> {contact.phone}
                  </a>
                )}
                {contact.address && (
                  <p className="flex items-start gap-2.5 whitespace-pre-line text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> {contact.address}
                  </p>
                )}
                {contact.contactUrl && (
                  <a
                    href={contact.contactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 pt-1 text-primary hover:underline"
                  >
                    Visit our contact page <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FaqRow({ faq }: { faq: Faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card">
      <button
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        <span>{faq.question}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="whitespace-pre-line px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
          {faq.answer}
        </div>
      )}
    </div>
  );
}

function HitRow({ accountId, hit }: { accountId: string; hit: SearchHit }) {
  const inner = (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {hit.kind === 'faq' ? 'FAQ' : hit.category || 'Article'}
      </p>
      <p className="mt-0.5 font-medium">{hit.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{hit.excerpt}</p>
    </div>
  );
  // Articles deep-link to their reader; FAQ has no standalone page.
  return hit.kind === 'article' && hit.slug ? (
    <Link href={`/support/${accountId}/a/${hit.slug}`}>{inner}</Link>
  ) : (
    inner
  );
}

function emptyContact(): Contact {
  return { email: null, phone: null, address: null, contactUrl: null, docsUrl: null };
}

/** Group doc cards by category, preserving first-seen category order. */
function groupByCategory(items: ArticleCard[]): Array<[string, ArticleCard[]]> {
  const map = new Map<string, ArticleCard[]>();
  for (const it of items) {
    const key = it.category ?? '';
    const arr = map.get(key);
    if (arr) arr.push(it);
    else map.set(key, [it]);
  }
  return Array.from(map.entries());
}

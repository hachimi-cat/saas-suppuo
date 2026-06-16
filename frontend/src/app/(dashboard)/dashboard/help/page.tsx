'use client';

/*
 * Help center management — the workspace's knowledge base (FAQ +
 * articles) plus the public contact profile and product deep-links that
 * feed the hosted help center at suppuo.com/support/<accountId>.
 *
 *   • Settings  — contact email/phone/address + intro + the product's
 *                 own /docs and /contact URLs (the "use the product's
 *                 data if it has it" deep-links). PUT /settings/help.
 *   • Content   — FAQ (question/answer) + articles (slug + markdown),
 *                 draft/published. CRUD /help/articles.
 */

import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';

interface Article {
  id: string;
  kind: 'faq' | 'article';
  slug: string | null;
  category: string | null;
  title: string;
  body: string;
  status: 'draft' | 'published';
  position: number;
}

interface HelpConfig {
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  docsUrl: string | null;
  contactUrl: string | null;
  helpIntro: string | null;
}

const EMPTY_DRAFT = {
  kind: 'faq' as 'faq' | 'article',
  slug: '',
  category: '',
  title: '',
  body: '',
  status: 'draft' as 'draft' | 'published',
  position: 0,
};

export default function HelpCenterAdminPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [cfg, setCfg] = useState<HelpConfig | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cfgSaved, setCfgSaved] = useState(false);

  useEffect(() => {
    load();
    apiRequest<HelpConfig>('/settings/help')
      .then(({ data }) => setCfg(data))
      .catch(() => setCfg(blankCfg()));
  }, []);

  function load() {
    apiRequest<{ articles: Article[] }>('/help/articles')
      .then(({ data }) => setArticles(data.articles))
      .catch(() => undefined);
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setCfgSaved(false);
    try {
      await apiRequest('/settings/help', { method: 'PUT', body: cfg });
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
    } catch {
      /* surfaced via the content error line is overkill; ignore */
    }
  }

  async function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: Record<string, unknown> = {
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      status: draft.status,
      category: draft.category || null,
      position: Number(draft.position) || 0,
    };
    if (draft.kind === 'article') payload.slug = draft.slug;
    try {
      if (editingId) {
        await apiRequest(`/help/articles/${editingId}`, { method: 'PATCH', body: payload });
      } else {
        await apiRequest('/help/articles', { method: 'POST', body: payload });
      }
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save');
    }
  }

  function startEdit(a: Article) {
    setEditingId(a.id);
    setDraft({
      kind: a.kind,
      slug: a.slug ?? '',
      category: a.category ?? '',
      title: a.title,
      body: a.body,
      status: a.status,
      position: a.position,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT });
    setError(null);
  }

  async function remove(id: string) {
    await apiRequest(`/help/articles/${id}`, { method: 'DELETE' }).catch(() => undefined);
    if (editingId === id) resetForm();
    load();
  }

  async function togglePublish(a: Article) {
    await apiRequest(`/help/articles/${a.id}`, {
      method: 'PATCH',
      body: { status: a.status === 'published' ? 'draft' : 'published' },
    }).catch(() => undefined);
    load();
  }

  const faqs = articles.filter((a) => a.kind === 'faq');
  const guides = articles.filter((a) => a.kind === 'article');

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Help center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your public help center lives at{' '}
          <code className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-xs">
            suppuo.com/support/&lt;workspace&gt;
          </code>
          . Manage its FAQ, articles, and contact details here.
        </p>
      </header>

      {/* ── Contact + product links ─────────────────────────────────── */}
      {cfg && (
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contact &amp; links
          </h2>
          <form onSubmit={saveConfig} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Intro line" full>
              <input value={cfg.helpIntro ?? ''} onChange={(e) => setCfg({ ...cfg, helpIntro: e.target.value })} placeholder="e.g. Answers, guides, and a way to reach us." className={inputCls} />
            </Field>
            <Field label="Contact email">
              <input type="email" value={cfg.contactEmail ?? ''} onChange={(e) => setCfg({ ...cfg, contactEmail: e.target.value })} placeholder="support@yourbrand.com" className={inputCls} />
            </Field>
            <Field label="Contact phone">
              <input value={cfg.contactPhone ?? ''} onChange={(e) => setCfg({ ...cfg, contactPhone: e.target.value })} placeholder="+62…" className={inputCls} />
            </Field>
            <Field label="Address" full>
              <textarea value={cfg.contactAddress ?? ''} onChange={(e) => setCfg({ ...cfg, contactAddress: e.target.value })} rows={2} placeholder="Street, city, country" className={inputCls} />
            </Field>
            <Field label="Documentation URL (product /docs)">
              <input value={cfg.docsUrl ?? ''} onChange={(e) => setCfg({ ...cfg, docsUrl: e.target.value })} placeholder="https://yourbrand.com/docs" className={inputCls} />
            </Field>
            <Field label="Contact page URL (product /contact)">
              <input value={cfg.contactUrl ?? ''} onChange={(e) => setCfg({ ...cfg, contactUrl: e.target.value })} placeholder="https://yourbrand.com/contact" className={inputCls} />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Save contact details
              </button>
              {cfgSaved && <span className="text-sm text-primary">Saved ✓</span>}
            </div>
          </form>
        </section>
      )}

      {/* ── Editor ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {editingId ? 'Edit item' : 'Add FAQ or article'}
        </h2>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <form onSubmit={submitDraft} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as 'faq' | 'article' })} className={inputCls + ' max-w-[140px]'}>
              <option value="faq">FAQ</option>
              <option value="article">Article</option>
            </select>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as 'draft' | 'published' })} className={inputCls + ' max-w-[150px]'}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Category (optional)" className={inputCls + ' flex-1'} />
          </div>
          {draft.kind === 'article' && (
            <input required value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="url-slug (lowercase-kebab)" className={inputCls} />
          )}
          <input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={draft.kind === 'faq' ? 'Question' : 'Article title'} className={inputCls} />
          <textarea required value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={draft.kind === 'faq' ? 3 : 8} placeholder={draft.kind === 'faq' ? 'Answer' : 'Article body (plain text / markdown)'} className={inputCls} />
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {editingId ? 'Save changes' : 'Add'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-border px-4 py-2 text-sm">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ── Lists ───────────────────────────────────────────────────── */}
      <ItemList title="FAQ" items={faqs} onEdit={startEdit} onRemove={remove} onToggle={togglePublish} empty="No FAQ yet — add your most common questions above." />
      <ItemList title="Articles" items={guides} onEdit={startEdit} onRemove={remove} onToggle={togglePublish} empty="No articles yet — longer guides show as cards on the help center." />
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ItemList({
  title,
  items,
  onEdit,
  onRemove,
  onToggle,
  empty,
}: {
  title: string;
  items: Article[];
  onEdit: (a: Article) => void;
  onRemove: (id: string) => void;
  onToggle: (a: Article) => void;
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {items.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{a.title}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    a.status === 'published'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {a.status}
                </span>
                {a.category && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {a.category}
                  </span>
                )}
              </p>
              <p className="mt-0.5 line-clamp-1 whitespace-pre-wrap text-xs text-muted-foreground">{a.body}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs">
              <button onClick={() => onToggle(a)} className="text-muted-foreground hover:text-foreground">
                {a.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => onEdit(a)} className="text-primary hover:underline">
                Edit
              </button>
              <button onClick={() => onRemove(a.id)} className="text-destructive hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function blankCfg(): HelpConfig {
  return {
    contactEmail: null,
    contactPhone: null,
    contactAddress: null,
    docsUrl: null,
    contactUrl: null,
    helpIntro: null,
  };
}

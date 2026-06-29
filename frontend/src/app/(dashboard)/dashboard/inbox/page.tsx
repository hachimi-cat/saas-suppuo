'use client';

/*
 * Agent inbox — the Suppuo home surface. Status tabs + filter bar
 * (assignee / tag / channel / priority) + debounced full-text search,
 * live from /api/v1/tickets (BFF session cookie). Cursor-paginated
 * ("Load more"). New-ticket dialog logs out-of-band inquiries
 * (WhatsApp/phone) as tickets.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { fetchMembers, type Member } from '@/lib/members';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requesterName: string | null;
  assigneeSub: string | null;
  tags: string[];
  lastMessageAt: string;
  createdAt: string;
}

interface ListResponse {
  tickets: Ticket[];
  counts: Record<string, number>;
  cursor: string | null;
  hasMore: boolean;
}

// Radix Select forbids value="" — use this sentinel for the "any/anyone" option.
const ALL = 'all';

const STATUS_TABS = ['all', 'open', 'pending', 'resolved', 'closed'] as const;
const CHANNELS = ['web', 'email', 'whatsapp', 'telegram'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const STATUS_TONES: Record<string, string> = {
  open: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  resolved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_TONES: Record<string, string> = {
  urgent: 'text-rose-500',
  high: 'text-amber-500',
  normal: 'text-muted-foreground',
  low: 'text-muted-foreground/60',
};

function rel(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

interface Filters {
  assignee: string; // '' | 'me' | 'unassigned' | <sub>
  tag: string;
  channel: string;
  priority: string;
}

const NO_FILTERS: Filters = { assignee: '', tag: '', channel: '', priority: '' };

function buildQuery(status: string, filters: Filters, q: string, cursor?: string): string {
  const params = new URLSearchParams({ status });
  if (filters.assignee) params.set('assignee', filters.assignee);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.priority) params.set('priority', filters.priority);
  if (q.trim()) params.set('q', q.trim());
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export default function InboxPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>('all');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState(''); // debounced copy of `search`
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const loadSeq = useRef(0);

  // Debounce the search box → `q` (300ms).
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (status: string, f: Filters, query: string) => {
    setError(null);
    const seq = ++loadSeq.current;
    try {
      const { data } = await apiRequest<ListResponse>(`/tickets?${buildQuery(status, f, query)}`);
      if (seq !== loadSeq.current) return; // stale response
      setTickets(data.tickets);
      setCounts(data.counts);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setError(e instanceof ApiRequestError ? e.message : 'Could not load tickets');
      setTickets([]);
      setHasMore(false);
    }
  }, []);

  useEffect(() => {
    load(tab, filters, q);
  }, [tab, filters, q, load]);

  // Autocomplete + member roster — best-effort, once.
  useEffect(() => {
    apiRequest<{ tags: string[] }>('/tickets/tags')
      .then(({ data }) => setTags(data.tags))
      .catch(() => undefined);
    fetchMembers().then(setMembers).catch(() => undefined);
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await apiRequest<ListResponse>(
        `/tickets?${buildQuery(tab, filters, q, cursor)}`,
      );
      setTickets((prev) => [...(prev ?? []), ...data.tickets]);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not load more tickets');
    } finally {
      setLoadingMore(false);
    }
  }

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: keyof Filters; label: string }> = [];
    if (filters.assignee) {
      const label =
        filters.assignee === 'me'
          ? 'Assigned to me'
          : filters.assignee === 'unassigned'
            ? 'Unassigned'
            : (members.find((m) => m.id === filters.assignee)?.name ??
              members.find((m) => m.id === filters.assignee)?.email ??
              filters.assignee);
      chips.push({ key: 'assignee', label: `Assignee: ${label}` });
    }
    if (filters.tag) chips.push({ key: 'tag', label: `Tag: ${filters.tag}` });
    if (filters.channel) chips.push({ key: 'channel', label: `Channel: ${filters.channel}` });
    if (filters.priority) chips.push({ key: 'priority', label: `Priority: ${filters.priority}` });
    return chips;
  }, [filters, members]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every customer request, in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            aria-label="Search tickets"
            className="w-48 sm:w-64"
          />
          <Button onClick={() => setShowNew(true)}>New ticket</Button>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              tab === s
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {s}
            {s === 'all' ? (total > 0 ? ` (${total})` : '') : counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={filters.assignee || ALL}
          onValueChange={(v) => setFilters((f) => ({ ...f, assignee: v === ALL ? '' : v }))}
        >
          <SelectTrigger aria-label="Filter by assignee" className="h-auto w-auto py-1.5 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Assignee: anyone</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members
              .filter((m) => !m.isYou)
              .map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.tag || ALL}
          onValueChange={(v) => setFilters((f) => ({ ...f, tag: v === ALL ? '' : v }))}
        >
          <SelectTrigger aria-label="Filter by tag" className="h-auto w-auto py-1.5 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tag: any</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.channel || ALL}
          onValueChange={(v) => setFilters((f) => ({ ...f, channel: v === ALL ? '' : v }))}
        >
          <SelectTrigger aria-label="Filter by channel" className="h-auto w-auto py-1.5 text-xs capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Channel: any</SelectItem>
            {CHANNELS.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.priority || ALL}
          onValueChange={(v) => setFilters((f) => ({ ...f, priority: v === ALL ? '' : v }))}
        >
          <SelectTrigger aria-label="Filter by priority" className="h-auto w-auto py-1.5 text-xs capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Priority: any</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeChips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilters((f) => ({ ...f, [c.key]: '' }))}
            className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary"
            title="Clear filter"
          >
            {c.label}
            <span aria-hidden>×</span>
          </button>
        ))}
        {(activeChips.length > 0 || search) && (
          <button
            onClick={() => {
              setFilters(NO_FILTERS);
              setSearch('');
            }}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {tickets === null ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {q || activeChips.length > 0
            ? 'No tickets match the current search/filters.'
            : tab === 'all'
              ? 'No tickets yet. Share your support form (Settings) or log one with “New ticket”.'
              : `No ${tab} tickets.`}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            {tickets.map((t) => {
              const assignee = members.find((m) => m.id === t.assigneeSub);
              const assigneeLabel = assignee ? (assignee.name ?? assignee.email) : t.assigneeSub;
              return (
                <Link
                  key={t.id}
                  href={`/dashboard/tickets/${t.id}`}
                  className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40"
                >
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                    #{t.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{t.subject}</span>
                      {(t.tags ?? []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="hidden shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground sm:inline"
                        >
                          {tag}
                        </span>
                      ))}
                      {(t.tags?.length ?? 0) > 3 && (
                        <span className="hidden shrink-0 text-[10px] text-muted-foreground/60 sm:inline">
                          +{t.tags.length - 3}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.requesterName ?? t.requesterEmail ?? t.requesterPhone} · {t.channel}
                    </span>
                  </span>
                  <span
                    className={`hidden text-xs font-medium capitalize sm:block ${PRIORITY_TONES[t.priority] ?? ''}`}
                  >
                    {t.priority !== 'normal' ? t.priority : ''}
                  </span>
                  {t.assigneeSub ? (
                    <Avatar
                      sub={t.assigneeSub}
                      nameOrEmail={assigneeLabel}
                      size={24}
                      className="text-[10px]"
                    />
                  ) : (
                    <span className="h-6 w-6 shrink-0" aria-hidden />
                  )}
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONES[t.status] ?? ''}`}
                  >
                    {t.status}
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                    {rel(t.lastMessageAt)}
                  </span>
                </Link>
              );
            })}
          </div>
          {hasMore && (
            <div className="mt-3 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary/50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewTicketDialog
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load(tab, filters, q);
          }}
        />
      )}
    </div>
  );
}

function NewTicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'web' | 'email'>('whatsapp');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/tickets', {
        method: 'POST',
        body: { subject, requesterEmail: email, requesterName: name || undefined, body, channel },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create ticket');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a ticket</DialogTitle>
          <DialogDescription>
            For requests that arrived outside the form — WhatsApp, phone, DM. The customer gets the
            status link by email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <div className="flex gap-2">
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Customer email" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
          </div>
          <Textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do they need?" rows={4} />
          <Select value={channel} onValueChange={(v) => setChannel(v as never)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">Came in via WhatsApp</SelectItem>
              <SelectItem value="email">Came in via email</SelectItem>
              <SelectItem value="web">Other / walk-in</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

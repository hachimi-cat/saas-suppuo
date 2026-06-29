'use client';

/*
 * Ticket thread — conversation + reply box (public reply or internal
 * note), status/priority controls, assignee member picker (Huudis IAM
 * roster), inline tag chips, canned-reply picker.
 */

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiRequestError, apiUrl, uploadFile } from '@/lib/api';
import { fetchMembers, memberLabel, type Member } from '@/lib/members';
import { Avatar } from '@/components/ui/avatar';
import {
  AttachmentComposer,
  MessageAttachments,
  type AttachmentMeta,
} from '@/components/ui/attachments';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Message {
  id: string;
  authorType: 'agent' | 'requester';
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
  attachments?: AttachmentMeta[];
}

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
  createdAt: string;
  messages: Message[];
}

interface CannedReply {
  id: string;
  title: string;
  body: string;
}

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [canned, setCanned] = useState<CannedReply[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<AttachmentMeta[]>([]);

  const load = useCallback(async () => {
    try {
      const { data } = await apiRequest<Ticket>(`/tickets/${id}`);
      setTicket(data);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not load ticket');
    }
  }, [id]);

  useEffect(() => {
    load();
    apiRequest<{ cannedReplies: CannedReply[] }>('/canned-replies')
      .then(({ data }) => setCanned(data.cannedReplies))
      .catch(() => undefined);
    fetchMembers().then(setMembers).catch(() => undefined);
    apiRequest<{ tags: string[] }>('/tickets/tags')
      .then(({ data }) => setTagSuggestions(data.tags))
      .catch(() => undefined);
  }, [load]);

  async function setField(field: 'status' | 'priority', value: string) {
    if (!ticket) return;
    try {
      await apiRequest(`/tickets/${ticket.id}`, { method: 'PATCH', body: { [field]: value } });
      load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Update failed');
    }
  }

  async function setAssignee(sub: string | null) {
    if (!ticket) return;
    setError(null);
    try {
      await apiRequest(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: { assigneeSub: sub },
      });
      load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Update failed');
    }
  }

  async function saveTags(tags: string[]) {
    if (!ticket) return;
    setError(null);
    // Optimistic — the reload below settles the normalized truth.
    setTicket({ ...ticket, tags });
    try {
      await apiRequest(`/tickets/${ticket.id}`, { method: 'PATCH', body: { tags } });
      load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Update failed');
      load();
    }
  }

  function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    const tag = newTag.trim().toLowerCase();
    if (!tag) return;
    setNewTag('');
    if ((ticket.tags ?? []).includes(tag)) return;
    saveTags([...(ticket.tags ?? []), tag]);
  }

  const mySub = members.find((m) => m.isYou)?.id ?? null;

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/tickets/${ticket.id}/messages`, {
        method: 'POST',
        body: {
          body: reply,
          isInternal: internal,
          ...(pendingFiles.length > 0
            ? { attachmentIds: pendingFiles.map((a) => a.id) }
            : {}),
        },
      });
      setReply('');
      setInternal(false);
      setPendingFiles([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Reply failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !ticket) {
    return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  }
  if (!ticket) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/inbox" className="text-sm text-muted-foreground hover:text-foreground">
        ← Inbox
      </Link>

      <header className="mt-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="mr-2 font-mono text-base text-muted-foreground">#{ticket.number}</span>
            {ticket.subject}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {ticket.requesterName ?? ticket.requesterEmail ?? ticket.requesterPhone} ({ticket.requesterEmail ?? ticket.requesterPhone}) · via{' '}
          {ticket.channel} · {new Date(ticket.createdAt).toLocaleString('en-GB')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Status
            <Select value={ticket.status} onValueChange={(v) => setField('status', v)}>
              <SelectTrigger
                aria-label="Status"
                className="h-8 w-[130px] gap-1.5 rounded-lg px-2 py-1 text-xs font-medium capitalize"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Priority
            <Select value={ticket.priority} onValueChange={(v) => setField('priority', v)}>
              <SelectTrigger
                aria-label="Priority"
                className="h-8 w-[120px] gap-1.5 rounded-lg px-2 py-1 text-xs font-medium capitalize"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Assignee
            {ticket.assigneeSub && (
              <Avatar
                sub={ticket.assigneeSub}
                nameOrEmail={memberLabel(ticket.assigneeSub, members)}
                size={24}
                className="text-[10px]"
              />
            )}
            <Select
              value={ticket.assigneeSub ?? 'none'}
              onValueChange={(v) => setAssignee(v === 'none' ? null : v)}
            >
              <SelectTrigger
                aria-label="Assignee"
                className="h-8 max-w-[180px] gap-1.5 rounded-lg px-2 py-1 text-xs font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name ? `${m.name} (${m.email})` : m.email}
                    {m.isYou ? ' — you' : ''}
                  </SelectItem>
                ))}
                {/* Keep an unknown sub visible (e.g. a member who left). */}
                {ticket.assigneeSub && !members.some((m) => m.id === ticket.assigneeSub) && (
                  <SelectItem value={ticket.assigneeSub}>{ticket.assigneeSub}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </label>
          {mySub && ticket.assigneeSub !== mySub && (
            <button
              onClick={() => setAssignee(mySub)}
              className="rounded-lg border border-primary/40 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Assign to me
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tags</span>
          {(ticket.tags ?? []).map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
            >
              {tag}
              <button
                onClick={() => saveTags((ticket.tags ?? []).filter((t) => t !== tag))}
                aria-label={`Remove tag ${tag}`}
                className="text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </span>
          ))}
          <form onSubmit={addTag} className="flex items-center">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              list="tag-suggestions"
              placeholder="+ add tag"
              maxLength={40}
              className="w-24 rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-xs focus:w-36 focus:border-primary/50 focus:outline-none"
            />
            <datalist id="tag-suggestions">
              {tagSuggestions
                .filter((t) => !(ticket.tags ?? []).includes(t))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </form>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.isInternal
                ? 'border-amber-500/40 bg-amber-500/5'
                : m.authorType === 'agent'
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card'
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">
                {m.authorType === 'agent' ? (m.authorName ?? 'You (agent)') : (m.authorName ?? 'Customer')}
                {m.isInternal && <span className="ml-2 text-amber-600">internal note</span>}
              </span>
              <span>{new Date(m.createdAt).toLocaleString('en-GB')}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            <MessageAttachments
              attachments={m.attachments}
              urlFor={(id) => apiUrl(`/attachments/${id}`)}
            />
          </div>
        ))}
      </div>

      <form onSubmit={sendReply} className="mt-5 space-y-2 rounded-xl border border-border p-4">
        {canned.length > 0 && (
          <Select
            value=""
            onValueChange={(v) => {
              const c = canned.find((x) => x.id === v);
              if (c) setReply((r) => (r ? `${r}\n\n${c.body}` : c.body));
            }}
          >
            <SelectTrigger
              aria-label="Insert canned reply"
              className="h-8 w-auto max-w-[240px] gap-1.5 rounded-lg px-2 py-1 text-xs"
            >
              <SelectValue placeholder="Insert canned reply…" />
            </SelectTrigger>
            <SelectContent>
              {canned.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={internal ? 'Internal note — the customer never sees this' : 'Reply to the customer (sent by email)'}
          rows={4}
          className={`w-full rounded-lg border bg-background px-3 py-2 text-sm ${internal ? 'border-amber-500/50' : 'border-border'}`}
        />
        <AttachmentComposer
          pending={pendingFiles}
          onChange={setPendingFiles}
          upload={(file) => uploadFile<AttachmentMeta>('/attachments', file)}
          disabled={busy}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            Internal note
          </label>
          <button
            disabled={busy || !reply.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Sending…' : internal ? 'Add note' : 'Send reply'}
          </button>
        </div>
      </form>
    </div>
  );
}

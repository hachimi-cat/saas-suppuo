'use client';

/*
 * Webhooks — deliver suppuo.* events to customer endpoints.
 * The signing secret (whsec_…) is shown ONCE at creation; deliveries
 * carry `Suppuo-Signature: t=<unix>,v1=<hmac-sha256(secret, t+"."+body)>`,
 * are retried 1 min … 12 h later and logged (the Recent deliveries list).
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface Subscription {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  consecutiveFailures: number;
  failingSince: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  createdAt: string;
}

interface EventType {
  type: string;
  description: string;
}

interface DeliveryAttempt {
  attemptNumber: number;
  status: 'succeeded' | 'failed';
  responseCode: number | null;
  durationMs: number;
  error: string | null;
  nextRetryAt: string | null;
  attemptedAt: string;
}

interface Delivery {
  id: string;
  subscriptionId: string;
  eventId: string;
  type: string;
  status: 'pending' | 'succeeded' | 'failed';
  attempts: number;
  nextRetryAt: string | null;
  responseCode: number | null;
  lastError: string | null;
  createdAt: string;
  attemptLog: DeliveryAttempt[];
}

/** Shown until GET /webhook-subscriptions/event-types answers (the backend's
 *  catalogue, lib/event-types.ts, is the source of truth). */
const FALLBACK_EVENT_TYPES: EventType[] = [
  { type: 'suppuo.ticket.created.v1', description: 'A new ticket arrived.' },
  { type: 'suppuo.ticket.replied.v1', description: 'A message was added to a ticket.' },
  { type: 'suppuo.ticket.status_changed.v1', description: 'A ticket moved between open / pending / resolved / closed.' },
  { type: 'suppuo.billing.subscribed.v1', description: 'A paid plan was activated on the workspace.' },
  { type: 'suppuo.webhook_subscription.disabled.v1', description: 'Suppuo switched off one of your subscriptions because it kept failing.' },
];

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

export default function WebhooksPage() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  // Secret of the most recently created endpoint — shown once, inline.
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Subscription | null>(null);
  const [catalog, setCatalog] = useState<EventType[]>(FALLBACK_EVENT_TYPES);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [openDelivery, setOpenDelivery] = useState<Delivery | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiRequest<{ subscriptions: Subscription[] }>(
        '/webhook-subscriptions',
      );
      setSubs(data.subscriptions);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not load webhooks');
      setSubs([]);
    }
    try {
      const { data } = await apiRequest<Delivery[]>('/webhook-subscriptions/deliveries?limit=25');
      setDeliveries(data);
    } catch {
      setDeliveries([]);
    }
  }, []);

  useEffect(() => {
    load();
    apiRequest<{ types: EventType[] }>('/webhook-subscriptions/event-types')
      .then(({ data }) => {
        if (data.types?.length) setCatalog(data.types);
      })
      .catch(() => undefined);
  }, [load]);

  async function retry(d: Delivery) {
    setRetrying(d.id);
    try {
      await apiRequest(`/webhook-subscriptions/deliveries/${d.id}/retry`, { method: 'POST' });
      toast.success('Queued — it goes out within a few seconds');
      setOpenDelivery(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : 'Could not retry the delivery');
    } finally {
      setRetrying(null);
    }
  }

  async function toggleActive(sub: Subscription) {
    try {
      await apiRequest(`/webhook-subscriptions/${sub.id}`, {
        method: 'PATCH',
        body: { active: !sub.active },
      });
      load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not update endpoint');
    }
  }

  async function remove(sub: Subscription) {
    try {
      await apiRequest(`/webhook-subscriptions/${sub.id}`, { method: 'DELETE' });
      if (newSecret?.id === sub.id) setNewSecret(null);
      load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not remove endpoint');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Webhooks"
        description="Get an HTTPS POST whenever something happens to your tickets."
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Add endpoint
          </button>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {newSecret && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Signing secret — shown once</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use it to verify the <code className="rounded bg-muted/60 px-1">Suppuo-Signature</code>{' '}
            header on every delivery. If you lose it, remove the endpoint and add it again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
              {newSecret.secret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newSecret.secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => {
                const blob = new Blob(
                  ['WEBHOOK_SIGNING_SECRET=' + newSecret.secret + '\n'],
                  { type: 'text/plain' },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'webhook-signing-secret.env';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Download
            </button>
            <button
              onClick={() => setNewSecret(null)}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {subs === null ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : subs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No endpoints yet. Add one to receive suppuo.ticket.* events.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {subs.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{s.url}</p>
                <p className="mt-0.5 flex flex-wrap gap-1">
                  {s.events.map((e) => (
                    <span
                      key={e}
                      className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      {e === '*' ? 'all events (*)' : e}
                    </span>
                  ))}
                </p>
                {s.disabledAt && (
                  <p className="mt-1 text-xs text-destructive">
                    Switched off {when(s.disabledAt)} — {s.disabledReason}. Fix the receiver, turn it
                    back on, then retry the failed deliveries below.
                  </p>
                )}
                {s.active && s.consecutiveFailures > 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    {s.consecutiveFailures} failed {s.consecutiveFailures === 1 ? 'attempt' : 'attempts'} in a
                    row since {when(s.failingSince)}.
                  </p>
                )}
              </div>
              <button
                onClick={() => toggleActive(s)}
                role="switch"
                aria-checked={s.active}
                title={s.active ? 'Deliveries on — click to pause' : 'Paused — click to resume'}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  s.active ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    s.active ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
              <span
                className={`w-24 shrink-0 text-xs font-medium ${
                  s.active ? 'text-emerald-600' : s.disabledAt ? 'text-destructive' : 'text-muted-foreground'
                }`}
                title={s.disabledReason ?? undefined}
              >
                {s.active ? 'Active' : s.disabledAt ? 'Switched off' : 'Paused'}
              </span>
              <button
                onClick={() => setPendingRemove(s)}
                className="shrink-0 text-xs text-destructive hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent deliveries
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The last 25 deliveries to your endpoints. A failed one is retried 1 min, 5 min, 25 min, 2 h
          and 12 h later; open a row to see every attempt.
        </p>
        {deliveries === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : deliveries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing delivered yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 font-medium">Endpoint</th>
                  <th className="py-2 pr-3 font-medium">Attempts</th>
                  <th className="py-2 pr-3 font-medium">Last result</th>
                  <th className="py-2 pr-3 font-medium">Next retry</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setOpenDelivery(d)}
                    className="cursor-pointer border-b border-border/60 last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="py-2 pr-3">
                      <Badge
                        variant={d.status === 'failed' ? 'destructive' : d.status === 'pending' ? 'secondary' : 'default'}
                      >
                        {d.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono">{d.type}</td>
                    <td className="max-w-[14rem] truncate py-2 pr-3 font-mono">
                      {subs?.find((s) => s.id === d.subscriptionId)?.url ?? d.subscriptionId}
                    </td>
                    <td className="py-2 pr-3">{d.attempts}</td>
                    <td className="py-2 pr-3">
                      {d.lastError ?? (d.responseCode ? `HTTP ${d.responseCode}` : '—')}
                    </td>
                    <td className="py-2 pr-3">{d.status === 'pending' ? when(d.nextRetryAt) : '—'}</td>
                    <td className="py-2">{when(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Event catalog
        </h2>
        <div className="mt-3 space-y-2">
          {catalog.map((e) => (
            <div key={e.type} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <code className="font-mono text-xs font-medium">{e.type}</code>
              <span className="text-xs text-muted-foreground">{e.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Verifying signatures
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every delivery is an HTTPS POST of <code className="rounded bg-muted/60 px-1 text-xs">{'{ id, type, occurredAt, data }'}</code>{' '}
          with a <code className="rounded bg-muted/60 px-1 text-xs">Suppuo-Signature</code> header. Recompute the
          HMAC with your signing secret and compare — reject anything older than ~5 minutes.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
{`Suppuo-Signature: t=<unix>,v1=<hex>

// Node.js
const crypto = require('node:crypto');
const [t, v1] = header.split(',').map((kv) => kv.split('=')[1]);
const expected = crypto
  .createHmac('sha256', WEBHOOK_SECRET)   // your whsec_… secret
  .update(\`\${t}.\${rawBody}\`)             // unix timestamp + "." + raw JSON body
  .digest('hex');
const valid =
  crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1)) &&
  Math.abs(Date.now() / 1000 - Number(t)) < 300;`}
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          Respond 2xx within 10 seconds. A failed delivery is retried 1 min, 5 min, 25 min, 2 h and 12 h
          later, so the same event can arrive more than once — deduplicate on its{' '}
          <code className="rounded bg-muted/60 px-1">id</code>. An endpoint failing 20 times in a row for
          over 24 hours is switched off.
        </p>
      </section>

      <Dialog
        open={!!openDelivery}
        onOpenChange={(o) => {
          if (!o) setOpenDelivery(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{openDelivery?.type}</DialogTitle>
            <DialogDescription>
              Delivery <span className="font-mono">{openDelivery?.id}</span> of event{' '}
              <span className="font-mono">{openDelivery?.eventId}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {openDelivery?.attemptLog.length === 0 && (
              <p className="text-sm text-muted-foreground">Not attempted yet.</p>
            )}
            {openDelivery?.attemptLog.map((a) => (
              <div key={a.attemptNumber} className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Attempt {a.attemptNumber}</span>
                  <Badge variant={a.status === 'failed' ? 'destructive' : 'default'}>{a.status}</Badge>
                  <span className="text-muted-foreground">{when(a.attemptedAt)}</span>
                  <span className="text-muted-foreground">{a.durationMs} ms</span>
                </div>
                <p className="mt-1">
                  {a.error ?? (a.responseCode ? `HTTP ${a.responseCode}` : 'no response')}
                  {a.nextRetryAt ? ` — next try ${when(a.nextRetryAt)}` : ''}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDelivery(null)}>
              Close
            </Button>
            {openDelivery && openDelivery.status !== 'pending' && (
              <Button disabled={retrying === openDelivery.id} onClick={() => retry(openDelivery)}>
                {retrying === openDelivery.id ? 'Queuing…' : openDelivery.status === 'failed' ? 'Retry' : 'Send again'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAdd && (
        <AddEndpointDialog
          catalog={catalog}
          onClose={() => setShowAdd(false)}
          onCreated={(created) => {
            setShowAdd(false);
            setNewSecret({ id: created.id, secret: created.secret });
            setCopied(false);
            load();
          }}
        />
      )}

      <AlertDialog
        open={!!pendingRemove}
        onOpenChange={(o) => {
          if (!o) setPendingRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the endpoint{' '}
              <span className="break-all font-mono">{pendingRemove?.url}</span>? Deliveries stop
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingRemove) remove(pendingRemove);
                setPendingRemove(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddEndpointDialog({
  catalog,
  onClose,
  onCreated,
}: {
  catalog: EventType[];
  onClose: () => void;
  onCreated: (created: { id: string; secret: string }) => void;
}) {
  const [url, setUrl] = useState('');
  const [allEvents, setAllEvents] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(type: string) {
    setSelected((cur) =>
      cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!allEvents && selected.length === 0) {
      setError('Pick at least one event (or subscribe to all).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiRequest<Subscription & { secret: string }>(
        '/webhook-subscriptions',
        { method: 'POST', body: { url, events: allEvents ? ['*'] : selected } },
      );
      onCreated({ id: data.id, secret: data.secret });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not add endpoint');
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add webhook endpoint</DialogTitle>
          <DialogDescription>
            You&apos;ll get the signing secret right after — it&apos;s shown only once.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Input
            required
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/suppuo"
          />
          <fieldset className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="webhook-all-events"
                checked={allEvents}
                onCheckedChange={(c) => setAllEvents(c === true)}
                className="mt-0.5"
              />
              <Label htmlFor="webhook-all-events" className="text-sm font-normal">
                All events <code className="font-mono text-xs text-muted-foreground">(*)</code>
              </Label>
            </div>
            {!allEvents &&
              catalog.map((ev) => (
                <div key={ev.type} className="flex items-start gap-2 pl-5">
                  <Checkbox
                    id={`webhook-event-${ev.type}`}
                    checked={selected.includes(ev.type)}
                    onCheckedChange={() => toggle(ev.type)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`webhook-event-${ev.type}`} className="text-sm font-normal">
                    <code className="font-mono text-xs">{ev.type}</code>
                  </Label>
                </div>
              ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Adding…' : 'Add endpoint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

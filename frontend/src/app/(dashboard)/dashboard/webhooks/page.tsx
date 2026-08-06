'use client';

/*
 * Webhooks — deliver suppuo.ticket.* events to customer endpoints.
 * The signing secret (whsec_…) is shown ONCE at creation; deliveries
 * carry `Suppuo-Signature: t=<unix>,v1=<hmac-sha256(secret, t+"."+body)>`.
 */

import { useCallback, useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';
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
  createdAt: string;
}

const EVENT_CATALOG: { type: string; description: string }[] = [
  { type: 'suppuo.ticket.created.v1', description: 'A new ticket arrived (form, email, WhatsApp, or logged by an agent).' },
  { type: 'suppuo.ticket.replied.v1', description: 'A message was added to a ticket (agent reply or requester follow-up).' },
  { type: 'suppuo.ticket.status_changed.v1', description: 'A ticket moved between open / pending / resolved / closed.' },
];

export default function WebhooksPage() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  // Secret of the most recently created endpoint — shown once, inline.
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Subscription | null>(null);

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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
                className={`w-14 shrink-0 text-xs font-medium ${
                  s.active ? 'text-emerald-600' : 'text-muted-foreground'
                }`}
              >
                {s.active ? 'Active' : 'Paused'}
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
          Event catalog
        </h2>
        <div className="mt-3 space-y-2">
          {EVENT_CATALOG.map((e) => (
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
          Delivery is at-most-once in v1 (failures are logged, not retried) — reconcile with{' '}
          <code className="rounded bg-muted/60 px-1">GET /api/v1/tickets</code> if you need certainty.
        </p>
      </section>

      {showAdd && (
        <AddEndpointDialog
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
  onClose,
  onCreated,
}: {
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
              EVENT_CATALOG.map((ev) => (
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

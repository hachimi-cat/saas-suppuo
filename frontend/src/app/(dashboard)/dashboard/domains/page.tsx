'use client';

/*
 * Custom domains — map your own domain (e.g. help.yourbrand.com) to your
 * hosted help center + portal. You CNAME it → suppuo.com and add a TXT
 * token; once verified, the Suppuo box provisions a TLS cert and serves
 * your help center at the domain root (`/`) and your portal at `/portal`
 * — no acc_…/slug in the URL.
 *
 * Flow: Add a domain → we show the DNS records to add → you add them at
 * your registrar → click Verify → we check DNS + kick off cert
 * provisioning → status flips to Active. Up to 5 per workspace.
 *
 * Backend (cookie-auth, same as the rest of /dashboard):
 *   GET    /domains
 *   POST   /domains              { domain }
 *   POST   /domains/:id/verify
 *   DELETE /domains/:id
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/button';
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

type DomainStatus = 'pending' | 'verifying' | 'active' | 'failed';

interface DnsInstructions {
  cname: { host: string; target: string };
  txt: { host: string; value: string };
}

interface Domain {
  id: string;
  domain: string;
  status: DomainStatus;
  sslProvisioned: boolean;
  createdAt: string;
  dnsInstructions: DnsInstructions;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiRequest<{ domains: Domain[] }>('/domains')
      .then(({ data }) => setDomains(data.domains))
      .catch(() => setDomains([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Light polling while any domain is still settling (pending/verifying) so
  // the badge flips to Active without a manual refresh.
  useEffect(() => {
    if (!domains) return;
    const settling = domains.some((d) => d.status === 'pending' || d.status === 'verifying');
    if (!settling) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [domains, load]);

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    const value = newDomain.trim().toLowerCase();
    if (!value) return;
    setAdding(true);
    setAddError(null);
    try {
      await apiRequest<Domain>('/domains', { method: 'POST', body: { domain: value } });
      setNewDomain('');
      load();
    } catch (err) {
      setAddError(
        err instanceof ApiRequestError ? err.message : 'Could not add this domain — try again.',
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Custom domains</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Serve your help center + portal on your own domain — e.g.{' '}
          <code className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-xs">
            help.yourbrand.com
          </code>
          . Add a domain, point its DNS at us, then verify. Up to 5 per workspace.
        </p>
      </header>

      {/* ── Add domain ──────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Add a domain
        </h2>
        <form onSubmit={addDomain} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Globe className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="help.yourbrand.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
          <button
            disabled={adding}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" /> {adding ? 'Adding…' : 'Add domain'}
          </button>
        </form>
        {addError && <p className="mt-2 text-sm text-destructive">{addError}</p>}
      </section>

      {/* ── List ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        {domains === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : domains.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Globe className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No custom domains yet. Add one above to serve your help center on your own URL.
            </p>
          </div>
        ) : (
          domains.map((d) => <DomainCard key={d.id} domain={d} onChanged={load} />)
        )}
      </section>
    </div>
  );
}

function DomainCard({ domain, onChanged }: { domain: Domain; onChanged: () => void }) {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);

  async function verify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      await apiRequest(`/domains/${domain.id}/verify`, { method: 'POST' });
      onChanged();
    } catch (err) {
      // 422 carries a helpful "CNAME/TXT not found yet" message — surface it.
      setVerifyError(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not verify — check the DNS records and try again.',
      );
    } finally {
      setVerifying(false);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      await apiRequest(`/domains/${domain.id}`, { method: 'DELETE' });
      onChanged();
    } catch {
      setRemoving(false);
    }
  }

  const active = domain.status === 'active';
  // Show DNS records until the domain is fully active — the customer still
  // needs them while pending/verifying/failed.
  const showDns = !active;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Globe className="size-4 shrink-0 text-primary" />
            <span className="truncate font-semibold">{domain.domain}</span>
            <StatusBadge status={domain.status} ssl={domain.sslProvisioned} />
          </div>
          {active && (
            <a
              href={`https://${domain.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              https://{domain.domain} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!active && (
            <button
              onClick={verify}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${verifying ? 'animate-spin' : ''}`} />
              {verifying ? 'Verifying…' : 'Verify'}
            </button>
          )}
          <button
            onClick={() => setPendingRemove(true)}
            disabled={removing}
            aria-label="Remove domain"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Remove
          </button>
        </div>
      </div>

      {verifyError && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {verifyError}
        </p>
      )}

      {showDns && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            Add these records at your DNS provider, then click Verify:
          </p>
          <div className="mt-2 space-y-2">
            <DnsRow
              type="CNAME"
              host={domain.dnsInstructions.cname.host}
              value={domain.dnsInstructions.cname.target}
            />
            <DnsRow
              type="TXT"
              host={domain.dnsInstructions.txt.host}
              value={domain.dnsInstructions.txt.value}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            DNS can take a few minutes to propagate. We&apos;ll provision an SSL certificate
            automatically once the records are found.
          </p>
        </div>
      )}

      <AlertDialog open={pendingRemove} onOpenChange={(o) => { if (!o) setPendingRemove(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {domain.domain}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your help center will stop serving on this domain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DnsRow({ type, host, value }: { type: string; host: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-background p-3 sm:grid-cols-[64px_1fr_1fr]">
      <span className="rounded bg-muted px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {type}
      </span>
      <CopyField label="Host / Name" value={host} />
      <CopyField label="Value" value={value} className="col-span-2 sm:col-span-1" />
    </div>
  );
}

function CopyField({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the value is still visible to select manually */
    }
  }
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={copy}
        title="Click to copy"
        className="flex w-full min-w-0 items-center gap-1.5 text-left font-mono text-xs text-foreground hover:text-primary"
      >
        <span className="truncate">{value}</span>
        {copied ? (
          <Check className="size-3 shrink-0 text-primary" />
        ) : (
          <Copy className="size-3 shrink-0 opacity-50" />
        )}
      </button>
    </div>
  );
}

function StatusBadge({ status, ssl }: { status: DomainStatus; ssl: boolean }) {
  const map: Record<DomainStatus, { label: string; icon: typeof Clock; cls: string }> = {
    pending: { label: 'Pending DNS', icon: Clock, cls: 'bg-muted text-muted-foreground' },
    verifying: {
      label: 'Provisioning',
      icon: Loader2,
      cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    },
    active: {
      label: ssl ? 'Active · SSL' : 'Active',
      icon: CheckCircle2,
      cls: 'bg-primary/15 text-primary',
    },
    failed: {
      label: 'Failed',
      icon: AlertTriangle,
      cls: 'bg-destructive/15 text-destructive',
    },
  };
  const { label, icon: Icon, cls } = map[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      <Icon className={`size-3 ${status === 'verifying' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

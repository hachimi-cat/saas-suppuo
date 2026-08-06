'use client';

/*
 * Billing — current plan + the 4 public pricing tiers, powered by
 * Plugipay hosted checkout.
 *
 * Early access: purchases are real and recorded truthfully, but
 * nothing is gated — every workspace gets Growth-level features free
 * until launch (mirrors the public /pricing copy). Upgrade buttons
 * POST /api/v1/billing/checkout and redirect to the returned
 * hostedUrl; Plugipay sends the browser back here with
 * ?status=success|canceled.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { fetchMembers } from '@/lib/members';
import { PageHeader } from '@/components/dashboard/page-header';

interface Subscription {
  id: string | null;
  accountId: string;
  tier: string;
  status: string;
  plugipayCheckoutSessionId: string | null;
  currentPeriodEnd: string | null;
}

interface TierDef {
  id: string;
  name: string;
  priceIdr: number;
  blurb: string;
  features: string[];
  /** Machine-readable plan terms (display now, enforcement at launch). */
  agentLimit: number;
  waNumberLimit: number;
}

interface BillingData {
  subscription: Subscription;
  earlyAccess: boolean;
  tiers: TierDef[];
}

const STATUS_TONES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  past_due: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  canceled: 'bg-muted text-muted-foreground border-border',
};

function rupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/** Live agent-seat usage: Huudis workspace members vs the tier's seat
 *  limit. Display only during early access — nothing is blocked. */
function SeatUsage({ limit, tierName }: { limit: number; tierName: string }) {
  const [used, setUsed] = useState<number | null>(null);

  useEffect(() => {
    fetchMembers()
      .then((m) => setUsed(m.length))
      .catch(() => setUsed(null));
  }, []);

  if (used === null) return null;
  const over = used > limit;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Agent seats
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">
          {used} of {limit}
        </span>
        <span className="text-muted-foreground">on {tierName}</span>
        {over && (
          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
            over the {tierName} limit
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${over ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${Math.min(100, Math.round((used / Math.max(1, limit)) * 100))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Agents = members of this workspace (manage them in Workspaces).
        {over
          ? ' Nothing is blocked during early access — pick a bigger plan before launch.'
          : ''}
      </p>
    </div>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get('status'); // success | canceled | null

  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyTier, setBusyTier] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<BillingData>('/billing')
      .then(({ data }) => setData(data))
      .catch((err) =>
        setError(err instanceof ApiRequestError ? err.message : 'Could not load billing'),
      );
  }, []);

  async function upgrade(tier: string) {
    setError(null);
    setBusyTier(tier);
    try {
      const { data } = await apiRequest<{ hostedUrl: string }>('/billing/checkout', {
        method: 'POST',
        body: { tier },
      });
      window.location.href = data.hostedUrl;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start checkout');
      setBusyTier(null);
    }
  }

  const sub = data?.subscription;
  const currentTier = sub?.tier ?? 'free';
  const currentDef = data?.tiers.find((t) => t.id === currentTier);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Billing"
        description="One flat price per workspace, billed in IDR through Plugipay."
      />

      {checkoutStatus === 'success' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
          <p className="font-medium">Payment received — thank you!</p>
          <p className="mt-1">
            Your plan updates as soon as Plugipay confirms the payment (usually a few
            seconds). Refresh if it hasn&apos;t appeared yet.
          </p>
        </div>
      )}
      {checkoutStatus === 'canceled' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
          <p className="font-medium">Checkout canceled.</p>
          <p className="mt-1">No charge was made — you can pick a plan again any time.</p>
        </div>
      )}

      {/* Early-access framing — mirrors the public /pricing page. */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-primary">
          Early access — everything free now, prices apply at launch.
        </p>
        <p className="mt-1 text-muted-foreground">
          Every workspace currently gets Growth-level features free. Buying a plan today
          records it truthfully — nothing is locked either way — and founding members get
          50% off for 12 months when billing starts.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Current plan ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Current plan
        </h2>
        {!data ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-2xl font-bold tracking-tight">
              {currentDef?.name ?? currentTier}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                STATUS_TONES[sub?.status ?? 'active'] ?? STATUS_TONES.active
              }`}
            >
              {(sub?.status ?? 'active').replace('_', ' ')}
            </span>
            <span className="text-sm text-muted-foreground">
              {currentDef && currentDef.priceIdr > 0
                ? `${rupiah(currentDef.priceIdr)}/mo`
                : 'Free'}
            </span>
            {sub?.currentPeriodEnd && (
              <span className="text-sm text-muted-foreground">
                Renews{' '}
                {new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        )}

        {/* Agent seats — live Huudis member count vs the tier's seat
            limit. Display only; enforcement comes at launch. */}
        {currentDef && <SeatUsage limit={currentDef.agentLimit} tierName={currentDef.name} />}
      </section>

      {/* ── Tier cards ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Plans
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(data?.tiers ?? []).map((tier) => {
            const isCurrent = tier.id === currentTier;
            return (
              <div
                key={tier.id}
                className={`flex flex-col rounded-xl border bg-card p-5 ${
                  isCurrent ? 'border-primary shadow-lg shadow-primary/10' : 'border-border shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold">{tier.name}</h3>
                  {isCurrent && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Current plan
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{tier.blurb}</p>
                <p className="mt-4">
                  <span className="text-2xl font-bold tabular-nums tracking-tight">
                    {rupiah(tier.priceIdr)}
                  </span>
                  {tier.priceIdr > 0 && (
                    <span className="ml-1 text-sm text-muted-foreground">/mo</span>
                  )}
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {tier.features.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs leading-[1.45] text-foreground/90"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2.25} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="mt-5 rounded-md border border-border py-2 text-center text-sm font-medium text-muted-foreground">
                    Your plan
                  </div>
                ) : tier.priceIdr === 0 ? (
                  <div className="mt-5 rounded-md border border-border py-2 text-center text-sm text-muted-foreground">
                    Default plan
                  </div>
                ) : (
                  <button
                    onClick={() => upgrade(tier.id)}
                    disabled={busyTier !== null || !data}
                    className="mt-5 rounded-md bg-primary py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {busyTier === tier.id ? 'Redirecting…' : `Upgrade to ${tier.name}`}
                  </button>
                )}
              </div>
            );
          })}
          {!data &&
            !error &&
            [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-xl border border-border bg-muted/40"
              />
            ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Payments are processed by Plugipay (QRIS, virtual account, e-wallet, card). Your
        tickets stay yours on every tier, paid or not.
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-5xl text-sm text-muted-foreground">Loading…</div>}
    >
      <BillingContent />
    </Suspense>
  );
}

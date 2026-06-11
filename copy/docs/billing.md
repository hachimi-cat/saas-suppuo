---
title: "Billing & plans"
---

# Billing & plans

Harga flat per workspace, dibayar dengan QRIS, VA, e-wallet, atau
kartu. Suppuo bills **per workspace** with flat monthly IDR pricing —
no per-seat surprises. Manage your plan at
[/dashboard/billing](/dashboard/billing).

## The tiers

| Tier | Price / month | For |
|---|---|---|
| **Gratis** | Rp 0 | Trying Suppuo out, or a one-person desk — 2 agents, 100 tickets/month, 10 canned replies, hosted form with Suppuo branding |
| **Warung** | Rp 99.000 | Small teams — 3 agents, unlimited tickets & canned replies, unbranded form, WhatsApp with your own number (1 connected number) |
| **Toko** | Rp 299.000 | Growing teams building on the API — 10 agents, up to 3 connected WhatsApp numbers, REST API + CLI |
| **Bisnis** | Rp 599.000 | Bigger teams — 25 agents, unlimited connected WhatsApp numbers, priority support |

WhatsApp is bring-your-own on every paid tier — [connect your own
Twilio account](/docs/channels#whatsapp-via-your-own-twilio) or
[Meta's Cloud API](/docs/channels#whatsapp-cloud-api-meta-direct);
messages are unlimited and billed by your provider, never metered by
Suppuo. The tiers differ only in how many numbers you can connect
(1 / 3 / unlimited). The full feature matrix lives on
[/pricing](/pricing) and in the portal's billing page; both render
from the same source of truth as the API
(`GET /api/v1/billing` returns the tier table).

## Early access — everything is free right now

Suppuo is in early access: **no limits are enforced anywhere** —
every workspace currently gets Toko-level features free. You *can*
buy a paid tier today; the purchase is real, the payment is real, and
your plan is recorded truthfully on the workspace — but it doesn't
unlock anything extra yet. Limits start applying at launch.

## How checkout works

1. On [/dashboard/billing](/dashboard/billing), pick a tier. The
   portal calls `POST /api/v1/billing/checkout` with `{"tier": "toko"}`
   and receives a hosted checkout URL.
2. Your browser is redirected to a **Plugipay hosted checkout page**
   (Plugipay is the Forjio family's payment service). Pay with
   **QRIS, virtual account, e-wallet, or card** — standard Indonesian
   payment methods, priced in IDR.
3. After paying (or canceling) you're sent back to
   `/dashboard/billing?status=success` (or `…=canceled`).

Gratis needs no checkout — it's the default for every workspace; the
absence of a subscription *is* the Gratis plan.

## After payment

The subscription is activated by Plugipay's payment webhook, not by
the browser redirect — so it goes through even if you close the tab
after paying:

- Your workspace's subscription is set to the purchased tier with
  status `active` for **30 days** (`currentPeriodEnd`).
- Activation is idempotent — a payment is never applied twice, no
  matter how often the payment notification is retried.
- A [`suppuo.billing.subscribed.v1`](/docs/webhooks#event-catalog)
  event fires, if you have webhook subscriptions listening.

If the redirect lands before the webhook does, the billing page may
show your old plan for a few seconds — refresh.

**No auto-renewal yet** in v1: there is no recurring charge wired up.
When a period ends, renew by running checkout again. (Recurring
billing is on the roadmap.)

## Checking your plan from the API

```bash
curl -H "Authorization: Bearer sk_live_…" \
  https://suppuo.com/api/v1/billing
```

```json
{
  "data": {
    "subscription": {
      "accountId": "acc_…",
      "tier": "toko",
      "status": "active",
      "currentPeriodEnd": "2026-07-11T03:00:00.000Z"
    },
    "earlyAccess": true,
    "tiers": [ "…the full tier table…" ]
  }
}
```

## See also

- [Channels](/docs/channels) — connect your own Twilio or Meta Cloud
  API number for WhatsApp.
- [Webhooks](/docs/webhooks) — react to `suppuo.billing.subscribed.v1`.
- [Getting started](/docs/getting-started) — workspace basics.

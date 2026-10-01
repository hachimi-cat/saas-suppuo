---
title: "Webhooks"
---

# Webhooks

Instead of polling, let Suppuo notify your systems. Webhooks
push **signed event notifications** to your own HTTPS endpoint
whenever something happens in your workspace — a new ticket, a reply,
a status change.

Manage endpoints at [/dashboard/webhooks](/dashboard/webhooks).

(Just want your *team* pinged on new tickets, no code? That's the
[Slack / Discord notification channels](/docs/channels#slack-notifications)
— paste a webhook URL and you're done. This page is the developer
surface for your own systems.)

## Create a subscription

In the portal, or via the API:

```bash
curl -X POST https://suppuo.com/api/v1/webhook-subscriptions \
  -H "Authorization: Bearer sk_live_…" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/hooks/suppuo",
    "events": ["suppuo.ticket.created.v1"]
  }'
```

- `url` — your HTTPS endpoint. It must be public: Suppuo refuses URLs
  that resolve to a private, loopback or link-local address (`400`
  with `url: blocked: …`).
- `events` — optional list (up to 20) of what to receive: an event
  type (`suppuo.ticket.created.v1`), a prefix ending in `*`
  (`suppuo.ticket.*`), or `"*"` for everything. Omit it to receive
  everything.

The response includes the signing `secret` (`whsec_…`) — **shown
exactly once**, never returned again. Store it; you need it to verify
deliveries.

`PATCH /api/v1/webhook-subscriptions/:id` changes `url`, `events` or
`active` (any of them; the secret stays the same):

- `{"active": false}` pauses the subscription — deliveries still queued
  for it become `failed`, and events raised while it is paused are not
  queued for it;
- `{"active": true}` resumes it — also after Suppuo switched it off for
  failing (below) — and clears its failure streak.

`DELETE /api/v1/webhook-subscriptions/:id` removes it. All of this is
in the portal too.

Each subscription in `GET /api/v1/webhook-subscriptions` carries its
health: `consecutiveFailures` (failed attempts in a row since the last
`2xx`), `failingSince`, and — when Suppuo switched it off —
`disabledAt` and `disabledReason`.

## Event catalog

| Event type | Fires when | `data` |
|---|---|---|
| `suppuo.ticket.created.v1` | A new ticket arrived: the web form, email, WhatsApp, Telegram, the requester portal, or logged by an agent | `ticketId`, `number`, `subject`, `channel` |
| `suppuo.ticket.replied.v1` | A message was added to a ticket: an agent reply or internal note (`by: "agent"`), or a requester follow-up from email, chat, the public ticket page or the requester portal (`by: "requester"`) | `ticketId`, `messageId`, `isInternal`, `by` |
| `suppuo.ticket.status_changed.v1` | A ticket moved between `open` / `pending` / `resolved` / `closed` | `ticketId`, `from`, `to` |
| `suppuo.billing.subscribed.v1` | A paid plan was activated on the workspace | `subscriptionId`, `tier`, `plugipayCheckoutSessionId`, `currentPeriodEnd` |
| `suppuo.webhook_subscription.disabled.v1` | Suppuo switched off one of your subscriptions because it kept failing (it goes to your *other* subscriptions) | `id`, `url`, `disabledAt`, `disabledReason`, `consecutiveFailures`, `failingSince` |

`GET /api/v1/webhook-subscriptions/event-types` returns the same list.
Event types are versioned (`.v1`); a breaking payload change ships as
a new version rather than mutating the old one.

## The delivery

Each delivery is an HTTP `POST` to your URL with a JSON body:

```json
{
  "id": "evt_01jx2v9k3m8q4r5s6t7u8v9w0x",
  "type": "suppuo.ticket.created.v1",
  "occurredAt": "2026-06-11T03:00:00.000Z",
  "data": { "ticketId": "tkt_…", "number": 42, "subject": "Refund", "channel": "email" }
}
```

and these headers:

| Header | Value |
|---|---|
| `Suppuo-Signature` | `t=<unix>,v1=<hex>` — see below |
| `Suppuo-Event-Id` | the event's `id` (`evt_…`) |
| `Suppuo-Event-Type` | the event's `type` |
| `Suppuo-Delivery-Id` | this delivery (`whd_…`) — one per event per subscription |
| `Suppuo-Delivery-Attempt` | `1` for the first attempt, then `2` … `6` |

`id` is the same on every attempt — use it to deduplicate, since a
retried event can reach you more than once.

## Verifying signatures

Every delivery carries a `Suppuo-Signature` header:

```
Suppuo-Signature: t=1781150400,v1=5257a869e7…
```

- `t` — unix timestamp (seconds) of when the delivery was signed,
- `v1` — hex HMAC-SHA256 of `` `${t}.${rawBody}` `` keyed with your
  `whsec_…` secret.

Recompute the HMAC over the **raw request body** (not a re-serialized
parse of it), compare in constant time, and reject stale timestamps —
5 minutes is the tolerance Suppuo itself uses:

```js
import crypto from "node:crypto";

function verifySuppuoSignature(secret, rawBody, header, toleranceSeconds = 300) {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express example — keep the raw body for verification:
app.post("/hooks/suppuo", express.raw({ type: "application/json" }), (req, res) => {
  const ok = verifySuppuoSignature(
    process.env.SUPPUO_WEBHOOK_SECRET,
    req.body.toString("utf8"),
    req.headers["suppuo-signature"] ?? "",
  );
  if (!ok) return res.status(401).end();
  const event = JSON.parse(req.body.toString("utf8"));
  // …handle event, respond fast:
  res.status(200).end();
});
```

This is the same `t=…,v1=…` HMAC convention used across the Forjio
family (Plugipay-HMAC etc.), so existing verifier code ports over
with just the header name and secret swapped.

## Delivery, retries and the delivery log

- A background worker picks events up within a second or two and
  queues one delivery per matching, active subscription.
- Respond `2xx` within **10 seconds**. Anything else — another status,
  a redirect (never followed), a timeout, a refused connection — is a
  failed attempt.
- A failed delivery is retried **1 min, 5 min, 25 min, 2 h and 12 h**
  later (6 attempts in all). After the 6th it is `failed` and stays so
  until you retry it.
- **Subscriptions that keep failing are switched off.** When one has
  failed **20 attempts in a row** and has been failing for **at least
  24 hours**, Suppuo sets `active: false` with `disabledAt` and
  `disabledReason`, marks its queued deliveries `failed`, and sends
  `suppuo.webhook_subscription.disabled.v1` to your other
  subscriptions. Both conditions must hold, so a short outage — a
  deploy, a few minutes of errors — never switches anyone off; the
  retries ride it out. Fix the receiver, resume the subscription
  (`PATCH … {"active": true}`), then retry what you missed.

Every delivery and every attempt is logged for **30 days**:

```bash
# newest first; filter by subscriptionId, status (pending | succeeded | failed) or type
curl "https://suppuo.com/api/v1/webhook-subscriptions/deliveries?status=failed&limit=20" \
  -H "Authorization: Bearer sk_live_…"

# one delivery, with every attempt (status, response code, duration, error, next retry)
curl https://suppuo.com/api/v1/webhook-subscriptions/deliveries/whd_… \
  -H "Authorization: Bearer sk_live_…"

# send it again now (202); 409 ALREADY_QUEUED when it is pending,
# 409 SUBSCRIPTION_DISABLED when its subscription is off
curl -X POST https://suppuo.com/api/v1/webhook-subscriptions/deliveries/whd_…/retry \
  -H "Authorization: Bearer sk_live_…"
```

The list pages with `limit` (1–100, default 20) and `meta.cursor` while
`meta.hasMore`. The portal's Webhooks page shows the same log with a
Retry button.

## See also

- [API keys](/docs/api-keys) — to call the subscription endpoints.
- [Tickets API](/docs/tickets) — the objects the events describe.
- [Billing](/docs/billing) — where `suppuo.billing.subscribed.v1`
  comes from.

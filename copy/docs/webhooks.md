---
title: "Webhooks"
---

# Webhooks

Daripada polling, biarkan Suppuo yang mengabari sistem Anda. Webhooks
push **signed event notifications** to your own HTTPS endpoint
whenever something happens in your workspace — a new ticket, a reply,
a status change.

Manage endpoints at [/dashboard/webhooks](/dashboard/webhooks).

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

- `url` — your HTTPS endpoint.
- `events` — optional allowlist of event types (up to 20). Omit it
  (or pass `["*"]`) to receive everything. Entries must be `"*"` or a
  versioned `suppuo.…vN` event type.

The response includes the signing `secret` (`whsec_…`) — **shown
exactly once**, never returned again. Store it; you need it to verify
deliveries.

Subscriptions can be paused and resumed
(`PATCH /api/v1/webhook-subscriptions/:id` with
`{"active": false}` / `{"active": true}`) or deleted
(`DELETE /api/v1/webhook-subscriptions/:id`) — all available from the
portal too.

## Event catalog

| Event type | Fires when |
|---|---|
| `suppuo.ticket.created.v1` | A new ticket arrived (form, WhatsApp, or logged by an agent) |
| `suppuo.ticket.replied.v1` | A message was added to a ticket (agent reply or requester follow-up) |
| `suppuo.ticket.status_changed.v1` | A ticket moved between `open` / `pending` / `resolved` / `closed` |
| `suppuo.billing.subscribed.v1` | A paid plan was activated on the workspace |

Event types are versioned (`.v1`); a breaking payload change ships as
a new version rather than mutating the old one.

## The delivery

Each delivery is an HTTP `POST` to your URL with a JSON body:

```json
{
  "id": "evt_01jx2v9k3m8q4r5s6t7u8v9w0x",
  "type": "suppuo.ticket.created.v1",
  "occurredAt": "2026-06-11T03:00:00.000Z",
  "data": { "…": "event-specific payload" }
}
```

`id` is unique per event — use it to deduplicate if your endpoint
ever sees the same event twice.

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

## Delivery semantics — honestly

v1 webhook delivery is **fire-and-forget**:

- Events are picked up by a background worker (typically within a
  second or two of the event) and POSTed to every active, matching
  subscription.
- Each request has a **5-second timeout**. Respond `2xx` quickly and
  do your processing async.
- A failed delivery (non-2xx, timeout, connection error) is logged on
  our side but **not retried**. There is no dead-letter queue yet —
  a retry queue is on the roadmap.

If your system needs certainty, treat webhooks as a low-latency hint
and reconcile periodically via
[`GET /api/v1/tickets`](/docs/tickets#list-tickets) — tickets carry
`lastMessageAt`, so diffing is cheap.

## See also

- [API keys](/docs/api-keys) — to call the subscription endpoints.
- [Tickets API](/docs/tickets) — the objects the events describe.
- [Billing](/docs/billing) — where `suppuo.billing.subscribed.v1`
  comes from.

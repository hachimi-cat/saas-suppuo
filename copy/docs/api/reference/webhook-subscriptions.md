---
title: Webhook subscriptions — reference
---

# Webhook subscriptions

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/webhook-subscriptions` | [List webhook subscriptions](#list-webhook-subscriptions) |
| `POST` | `/api/v1/webhook-subscriptions` | [Register an endpoint.](#register-an-endpoint) |
| `DELETE` | `/api/v1/webhook-subscriptions/{id}` | [Delete a webhook subscription](#delete-a-webhook-subscription) |
| `PATCH` | `/api/v1/webhook-subscriptions/{id}` | [Update a subscription. `active: false` pauses it (its queued deliveries become failed); `active: true` re-enables it — also after Suppuo switched it off for failing — and clears its failure streak.](#update-a-subscription-active-false-pauses-it-its-queued-deliveries-become-failed-active-true-re-enables-it-also-after-suppuo-switched-it-off-for-failing-and-clears-its-failure-streak) |
| `GET` | `/api/v1/webhook-subscriptions/deliveries` | [List webhook deliveries.](#list-webhook-deliveries) |
| `GET` | `/api/v1/webhook-subscriptions/deliveries/{id}` | [Get a webhook delivery, with every attempt made at it.](#get-a-webhook-delivery-with-every-attempt-made-at-it) |
| `POST` | `/api/v1/webhook-subscriptions/deliveries/{id}/retry` | [Retry a webhook delivery.](#retry-a-webhook-delivery) |
| `GET` | `/api/v1/webhook-subscriptions/event-types` | [The event types a subscription can receive, with what each one means.](#the-event-types-a-subscription-can-receive-with-what-each-one-means) |

## List webhook subscriptions

```
GET /api/v1/webhook-subscriptions
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/webhook-subscriptions" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Register an endpoint.

```
POST /api/v1/webhook-subscriptions
```

Register an endpoint. The response is the only time its signing secret
is returned. The URL must be https and must not point at a private,
loopback or link-local address.

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string (uri) | yes | max length 2000 |
| `events` | array of string | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/webhook-subscriptions" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"url":"…","events":[]}'
```

## Delete a webhook subscription

```
DELETE /api/v1/webhook-subscriptions/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://suppuo.com/api/v1/webhook-subscriptions/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Update a subscription. `active: false` pauses it (its queued deliveries become failed); `active: true` re-enables it — also after Suppuo switched it off for failing — and clears its failure streak.

```
PATCH /api/v1/webhook-subscriptions/{id}
```

Update a subscription. `active: false` pauses it (its queued deliveries
become failed); `active: true` re-enables it — also after Suppuo switched
it off for failing — and clears its failure streak. A new `url` goes
through the same checks as on create; the signing secret stays the same.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string (uri) | no | max length 2000 |
| `events` | array of string | no |  |
| `active` | boolean | no |  |

### Example

```bash
curl -X PATCH "https://suppuo.com/api/v1/webhook-subscriptions/:id" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"url":"…","events":[],"active":false}'
```

## List webhook deliveries.

```
GET /api/v1/webhook-subscriptions/deliveries
```

List webhook deliveries. Newest first: one row per event per
subscription, with its status (pending, succeeded, failed), attempt
count, next retry, the body sent and every attempt made (`attemptLog`).
Filter by `subscriptionId`, `status` or `type`; page with `limit`
(1-100, default 20) and `meta.cursor` while `meta.hasMore`.

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | no | default `20`; min 1; max 100 |
| `cursor` | string | no | min length 1 |
| `subscriptionId` | string | no | min length 1 |
| `status` | `pending` or `succeeded` or `failed` | no |  |
| `type` | string | no | min length 1 |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/webhook-subscriptions/deliveries" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Get a webhook delivery, with every attempt made at it.

```
GET /api/v1/webhook-subscriptions/deliveries/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/webhook-subscriptions/deliveries/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Retry a webhook delivery.

```
POST /api/v1/webhook-subscriptions/deliveries/{id}/retry
```

Retry a webhook delivery. Queues one more attempt now at a failed
delivery (or sends a succeeded one again); it goes out within seconds —
read it back with GET /webhook-subscriptions/deliveries/{id}. 202 with the
delivery `pending`; 409 ALREADY_QUEUED when it is pending already, 409
SUBSCRIPTION_DISABLED when its subscription is off.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/webhook-subscriptions/deliveries/:id/retry" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## The event types a subscription can receive, with what each one means.

```
GET /api/v1/webhook-subscriptions/event-types
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/webhook-subscriptions/event-types" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

---
title: Billing — reference
---

# Billing

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/billing` | [Current subscription (free default when no row) + the tier table the portal renders.](#current-subscription-free-default-when-no-row-the-tier-table-the-portal-renders) |
| `POST` | `/api/v1/billing/checkout` | [POST /checkout {tier} — create a Plugipay hosted checkout session for a paid tier; the browser redirects to data.hostedUrl.](#post-checkout-tier-create-a-plugipay-hosted-checkout-session-for-a-paid-tier-the-browser-redirects-to-datahostedurl) |

## Current subscription (free default when no row) + the tier table the portal renders.

```
GET /api/v1/billing
```

GET / — current subscription (free default when no row) + the
 tier table the portal renders.

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/billing" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## POST /checkout {tier} — create a Plugipay hosted checkout session for a paid tier; the browser redirects to data.hostedUrl.

```
POST /api/v1/billing/checkout
```

POST /checkout {tier} — create a Plugipay hosted checkout session
 for a paid tier; the browser redirects to data.hostedUrl. The
 subscription itself is only written when the
 plugipay.checkout_session.completed.v1 webhook lands.

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `tier` | `free` or `starter` or `growth` or `business` | yes |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/billing/checkout" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"tier":"free"}'
```

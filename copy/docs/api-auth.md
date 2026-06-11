---
title: "API authentication"
---

# API authentication

Semua yang dilakukan portal lewat API ini — dan API yang sama terbuka
untuk otomasi Anda. This page covers how to authenticate against the
Suppuo REST API, the response envelope every endpoint shares, and how
errors come back.

## Base URL

```
https://suppuo.com/api/v1
```

(`https://suppuo.forjio.com/api/v1` serves the same API.)

## Three ways in

### Portal session (browser)

The dashboard authenticates with a session cookie minted by Suppuo's
sign-in flow (Huudis SSO). If you're building on top of the portal in
the browser, you're already authenticated — fetches to `/api/v1/*`
ride the cookie. Nothing to configure.

### API key (recommended for automation)

Create an `sk_live_…` key at
[/dashboard/api-keys](/dashboard/api-keys) and send it as a Bearer
token:

```bash
curl -H "Authorization: Bearer sk_live_…" \
  "https://suppuo.com/api/v1/tickets?status=open"
```

Keys are long-lived (no expiry — revoke to kill), scoped to the
workspace they were created in, and shown only once at creation.
Full details on [API keys](/docs/api-keys). This is the simplest
credential for scripts, cron jobs, and integrations — no token
refresh dance.

### Huudis JWT (Bearer)

Callers that already hold a **Huudis access token** can use it
directly as a bearer token:

```
Authorization: Bearer <access-token>
```

Huudis is the shared Forjio identity service — your Suppuo login *is*
a Huudis account ([huudis.com](https://huudis.com)). Access tokens are
issued by Huudis for the `suppuo` audience and carry your identity
(`sub`) and workspace (`accountId`); every API call is scoped to that
workspace. Tokens are short-lived — refresh and retry on
`AUTH_REQUIRED` rather than caching one forever. (If that dance is
annoying, that's what API keys are for.)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://suppuo.com/api/v1/tickets?status=open"
```

A missing or invalid token gets `401`:

```json
{
  "data": null,
  "error": { "code": "AUTH_REQUIRED", "message": "Missing Authorization header" },
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T03:00:00.000Z" }
}
```

The [public form endpoints](/docs/public-form#the-public-api)
(`/api/v1/public/*`) are the exception — they're unauthenticated by
design and use the requester's access token in the URL instead.

## Response envelope

Every endpoint — success or failure — returns the same envelope:

```json
{
  "data": { },
  "error": null,
  "meta": {
    "requestId": "req_01jx2v9k3m8q4r5s6t7u8v9w0x",
    "timestamp": "2026-06-11T03:00:00.000Z"
  }
}
```

- **Success:** `data` is the payload, `error` is `null`. Created
  resources come back with HTTP `201`.
- **Failure:** `data` is `null`, `error` is set, and the HTTP status
  matches (`400`, `401`, `403`, `404`, `409`, `500`).

## Errors

`error` carries an `UPPER_SNAKE_CASE` code plus a human-readable
message, and sometimes a `param` naming the offending field:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "status must be one of open, pending, resolved, closed"
  },
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T03:00:00.000Z" }
}
```

The codes you'll meet:

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Bad or missing field — the message says which |
| `AUTH_REQUIRED` | 401 | Missing/invalid credentials |
| `FORBIDDEN` | 403 | Authenticated, but not allowed |
| `NOT_FOUND` | 404 | Resource doesn't exist in your workspace |
| `CONFLICT` | 409 | State conflict |
| `INTERNAL_ERROR` | 500 | Our fault — retry, then contact support |

Match on `error.code`, not the message — messages may be reworded;
codes are stable.

## Request IDs

Every response carries a unique `meta.requestId` (`req_…`). When you
contact support about an API issue, include it — it points us at the
exact request in our logs.

## Rate limits

The API is rate-limited, with the unauthenticated public endpoints
limited most aggressively. Responses include the standard headers:

```
X-RateLimit-Limit: 2000
X-RateLimit-Remaining: 1999
X-RateLimit-Reset: 1781150460
```

Back off when `X-RateLimit-Remaining` approaches zero
(`X-RateLimit-Reset` is a unix timestamp). Polling the inbox? Once
per 30–60 seconds is plenty — tickets carry `lastMessageAt` so you can
diff cheaply.

## See also

- [API keys](/docs/api-keys) — minting, storage, and revoking
  `sk_live_…` keys.
- [Tickets API](/docs/tickets) — the main authenticated surface.
- [Webhooks](/docs/webhooks) — push notifications instead of polling.
- [CLI](/docs/cli) — `suppuo` on your terminal.

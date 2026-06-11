---
title: "API keys"
---

# API keys

API keys for scripts and integrations — no browser login needed. An
**API key** is a long-lived `sk_live_…` token that authenticates your
scripts, servers, and integrations against the Suppuo REST API,
scoped to one workspace.

Manage them at [/dashboard/api-keys](/dashboard/api-keys).

## Create a key

In the portal: **API Keys** → name it (e.g. `n8n automation`) →
create. Or over the API (with an existing credential):

```bash
curl -X POST https://suppuo.com/api/v1/api-keys \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "n8n automation"}'
```

```json
{
  "data": {
    "id": "ak_01jx…",
    "name": "n8n automation",
    "keyPrefix": "sk_live_a1b2",
    "key": "sk_live_a1b2c3…48 hex chars…",
    "createdAt": "2026-06-11T03:00:00.000Z"
  }
}
```

> **The full key is shown exactly once**, in this creation response
> (the portal shows it once with a copy button). Store it like a
> password — there is no way to retrieve it again, only to revoke it
> and mint a new one.

## Use a key

Send it as a Bearer token on any `/api/v1` endpoint — everywhere a
Huudis JWT works, an API key works too:

```bash
curl -H "Authorization: Bearer sk_live_…" \
  "https://suppuo.com/api/v1/tickets?status=open"
```

Every call authenticated with a key acts inside **the workspace the
key was created in** — tickets, canned replies, channels, webhooks,
billing. Keys don't expire; they work until you revoke them. The
[CLI](/docs/cli) and all three [SDKs](/docs/cli#sdks) accept a key
via the `SUPPUO_TOKEN` environment variable.

## How keys are stored

- The plaintext is **never persisted**. Suppuo stores only a SHA-256
  hash of the key, plus a display-safe prefix (`sk_live_` + the first
  4 characters) so you can tell keys apart in the list.
- Authentication hashes the presented token and looks up that hash —
  a database leak does not leak usable keys.
- Each key tracks `lastUsedAt`, shown in the portal, so you can spot
  (and revoke) keys nothing uses anymore.

## Revoke a key

From the portal, or:

```bash
curl -X DELETE https://suppuo.com/api/v1/api-keys/ak_01jx… \
  -H "Authorization: Bearer <token>"
```

Revocation is immediate — the next request with that key gets `401
INVALID_TOKEN`.

## See also

- [API authentication](/docs/api-auth) — all the ways to
  authenticate, including Huudis JWTs.
- [Tickets API](/docs/tickets) — the main surface you'll call.
- [Webhooks](/docs/webhooks) — push instead of poll.

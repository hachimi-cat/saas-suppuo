---
title: "Hosted support form"
---

# Hosted support form

Pelanggan Anda tidak perlu akun, tidak perlu install apa-apa — cukup
buka satu link. The hosted form is Suppuo's zero-setup channel: a
public page where customers submit inquiries, plus a private,
tokenized status page where they follow up. Everything on this page is
**unauthenticated** — no login, no API key.

## Your form URL

Every workspace gets a hosted form at:

```
https://suppuo.com/support/<accountId>
```

Find your exact URL (with your `acc_…` workspace ID filled in) in the
dashboard under **Settings → Your support form**, with a copy button.
Share it anywhere: bio link, website footer, marketplace store page,
WhatsApp auto-reply.

Submissions become tickets in your inbox with `channel: "web"`.

## How the requester side works

1. The customer submits the form (subject, message, email, optional
   name).
2. They immediately see their ticket number and a private **status
   link**:

   ```
   https://suppuo.com/t/<token>
   ```

3. The same link arrives in the [ticket-received
   email](/docs/email-notifications). The token is the customer's only
   credential — anyone with the link can view the public thread and
   reply, so it should be treated like a password-reset link.
4. On the status page they see the conversation and can reply.
   **Internal notes are never shown there** — only public messages.

## The public API

The hosted form, the status page, and the
[live chat widget](/docs/live-chat-widget) are all built on the same
public endpoints. You can call them directly — e.g. to build your own
branded form on your website while keeping Suppuo as the inbox.

These endpoints are **rate-limited**; responses carry
`X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`
headers. All responses use the standard
[envelope](/docs/api-auth#response-envelope).

### Submit a ticket

```
POST /api/v1/public/tickets
```

| Field | Type | Notes |
|---|---|---|
| `accountId` | string | required — the workspace's `acc_…` ID (the one in your form URL) |
| `subject` | string | required, 1–300 chars |
| `body` | string | required, 1–20 000 chars |
| `email` | string | required, valid email |
| `name` | string | optional, ≤200 chars |

```bash
curl -X POST "https://suppuo.com/api/v1/public/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_5f1e2d3c4b5a69788796a5b4",
    "subject": "Resi belum muncul",
    "body": "Order #1042 sudah 2 hari belum ada resi.",
    "email": "budi@example.com",
    "name": "Budi"
  }'
```

```json
{
  "data": {
    "number": 42,
    "accessToken": "Vq3…x9A"
  },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T03:21:09.000Z" }
}
```

Returns `201`. The response deliberately contains only the ticket
number and the access token — the token is the requester's credential;
hand it to them as `https://suppuo.com/t/<accessToken>`. The
ticket-received email (with the same link) is sent automatically.

### View a ticket (status page)

```
GET /api/v1/public/tickets/:accessToken
```

Returns the public view of the ticket. Internal notes are filtered out
server-side and are **never** exposed on this surface.

```json
{
  "data": {
    "number": 42,
    "subject": "Resi belum muncul",
    "status": "pending",
    "createdAt": "2026-06-11T03:21:09.000Z",
    "csat": null,
    "messages": [
      {
        "id": "tmsg_01jx…",
        "authorType": "requester",
        "authorName": "Budi",
        "body": "Order #1042 sudah 2 hari belum ada resi.",
        "createdAt": "2026-06-11T03:21:09.000Z",
        "attachments": []
      },
      {
        "id": "tmsg_01jx…",
        "authorType": "agent",
        "authorName": "Dewi",
        "body": "Halo Budi! Resi sudah kami update: JNE 1234567890.",
        "createdAt": "2026-06-11T04:05:00.000Z",
        "attachments": [
          { "id": "att_01jx…", "filename": "resi.pdf", "contentType": "application/pdf", "size": 48213, "createdAt": "2026-06-11T04:05:00.000Z" }
        ]
      }
    ]
  },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T05:00:00.000Z" }
}
```

`404 NOT_FOUND` for an unknown token. `csat` is the ticket's rating
(`{ score, comment }`) once the requester has rated, `null` before —
see [Automation & CSAT](/docs/automation-csat#csat-surveys). Each
message lists its attachment metadata; download the bytes via the
token-scoped attachment endpoint —
[Attachments](/docs/attachments#the-public-requester-surface).

### Requester reply

```
POST /api/v1/public/tickets/:accessToken/messages
```

| Field | Type | Notes |
|---|---|---|
| `body` | string | required, 1–20 000 chars |
| `attachmentIds` | string[] | optional, ≤5 — ids from the token-scoped upload endpoint; see [Attachments](/docs/attachments#the-public-requester-surface) |

```bash
curl -X POST "https://suppuo.com/api/v1/public/tickets/Vq3…x9A/messages" \
  -H "Content-Type: application/json" \
  -d '{ "body": "Sudah masuk, terima kasih!" }'
```

```json
{
  "data": { "id": "tmsg_01jx…", "status": "open" },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T05:10:00.000Z" }
}
```

Returns `201`. A requester reply always moves the ticket back to
`open` — including on `resolved` and `closed` tickets — so it
resurfaces in your inbox.

### Rate the experience (CSAT)

```
POST /api/v1/public/tickets/:accessToken/csat
```

Records the requester's satisfaction rating once the ticket is
`resolved` or `closed` (`409 CONFLICT` before that). Fields and the
full survey flow are documented in
[Automation & CSAT](/docs/automation-csat#csat-endpoints).

### Attachments

The public surface also has token-scoped upload and download
endpoints (`…/:accessToken/attachments`) — covered in
[Attachments](/docs/attachments#the-public-requester-surface).

## See also

- [Live chat widget](/docs/live-chat-widget) — the embeddable chat
  bubble built on these endpoints.
- [Tickets API](/docs/tickets) — the authenticated agent side of the
  same tickets.
- [Email notifications](/docs/email-notifications) — the emails the
  requester receives.

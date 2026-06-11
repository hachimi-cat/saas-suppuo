---
title: "Tickets API"
---

# Tickets API

API tiket adalah jantungnya Suppuo — semua yang bisa dilakukan agen di
portal, bisa juga lewat API. The tickets API is the agent surface:
list the inbox, log inquiries, reply, and update status/priority. All
endpoints require [authentication](/docs/api-auth) and operate on the
workspace your credentials belong to.

Base URL:

```
https://suppuo.com/api/v1
```

All responses use the standard envelope
`{ data, error, meta: { requestId, timestamp } }` — see
[API authentication](/docs/api-auth#response-envelope).

## The ticket object

```json
{
  "id": "tkt_01jx2v9k3m8q4r5s6t7u8v9w0x",
  "accountId": "acc_5f1e2d3c4b5a69788796a5b4",
  "number": 42,
  "subject": "Resi belum muncul",
  "status": "open",
  "priority": "normal",
  "channel": "web",
  "requesterEmail": "budi@example.com",
  "requesterName": "Budi",
  "requesterPhone": null,
  "requesterExternalId": null,
  "assigneeSub": null,
  "tags": ["pengiriman", "vip"],
  "accessToken": "Vq3...x9A",
  "createdAt": "2026-06-11T03:21:09.000Z",
  "updatedAt": "2026-06-11T03:21:09.000Z",
  "lastMessageAt": "2026-06-11T03:21:09.000Z"
}
```

- `number` — per-workspace, human-friendly (`#42`).
- `channel` — `web` (hosted form + [live chat
  widget](/docs/live-chat-widget)), `email`
  ([email-to-ticket](/docs/email-to-ticket) or logged by an agent),
  `whatsapp`, or `telegram`.
- `requesterEmail` / `requesterPhone` / `requesterExternalId` — any
  may be `null`: WhatsApp-channel tickets are identified by phone,
  Telegram tickets by their chat id (`requesterExternalId`), and
  either kind may have no email at all.
- `assigneeSub` — the Huudis `sub` of the assigned agent, or `null`.
- `tags` — free-form labels, normalized server-side (trimmed,
  lowercased, deduped; max 10 tags of 40 chars each).
- `accessToken` — the requester's private status-link token
  (`/t/<accessToken>`). Treat it as a secret: anyone holding it can
  read the public thread and reply as the requester.

### Ticket statuses

`status` is one of `open`, `pending`, `resolved`, `closed`, and moves
automatically as messages land:

| Event | Transition |
|---|---|
| Requester replies (form, widget, status link, email, WhatsApp, or Telegram) | → `open` — always, including from `resolved` and `closed`. A customer who writes back needs eyes on it. |
| Agent sends a **public** reply | → `pending` (waiting on the requester). `resolved` and `closed` tickets stay where they are. |
| Agent adds an **internal note** | no transition. |

Agents can also set the status directly via [PATCH](#update-a-ticket)
— e.g. to `resolved` when the conversation is done.

`priority` is one of `low`, `normal`, `high`, `urgent` (default
`normal`). Priority never changes automatically.

## List tickets

```
GET /api/v1/tickets
```

Query parameters — all combinable:

| Param | Type | Notes |
|---|---|---|
| `status` | string | `open`, `pending`, `resolved`, `closed`, or `all` (default `all`) |
| `assignee` | string | an agent's Huudis `sub`, `me` (the caller), or `unassigned` |
| `tag` | string | tickets carrying this tag (matched normalized — case-insensitive) |
| `channel` | string | `web`, `email`, `whatsapp`, or `telegram` |
| `priority` | string | `low`, `normal`, `high`, or `urgent` |
| `q` | string | free-text search (≤200 chars) across subject, requester email/name, and **message bodies**, case-insensitive |
| `limit` | int | 1–100, default 50 |
| `cursor` | string | opaque pagination cursor from a previous page |

Tickets are sorted by `lastMessageAt` descending (most recently active
first). The response also carries per-status counts for the whole
workspace, regardless of the filter — handy for inbox tab badges —
plus a `cursor` + `hasMore` pair for pagination: pass `cursor` back
to get the next page.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://suppuo.com/api/v1/tickets?status=open&assignee=me&tag=pengiriman&q=resi&limit=20"
```

```json
{
  "data": {
    "tickets": [ { "id": "tkt_01jx…", "number": 42, "status": "open", "...": "…" } ],
    "counts": { "open": 3, "pending": 7, "resolved": 12, "closed": 30 },
    "cursor": "eyJjcmVhdGVkQXQiOi…",
    "hasMore": true
  },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T03:25:00.000Z" }
}
```

A note on `assignee=me`: it resolves against the caller's own
identity. On an API-key call without an agent identity it matches
nothing (rather than leaking the whole inbox).

## List tags

```
GET /api/v1/tickets/tags
```

The distinct tags across all of your workspace's tickets, sorted —
this is what feeds the tag-filter autocomplete in the inbox.

```json
{
  "data": { "tags": ["komplain", "pengiriman", "refund", "vip"] },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T03:25:00.000Z" }
}
```

## Create a ticket

```
POST /api/v1/tickets
```

For logging an inquiry that arrived **out-of-band** — a phone call, a
DM, a WhatsApp chat on your personal number. The requester still gets
the ticket-received email with their status link, so the rest of the
conversation can continue in Suppuo.

| Field | Type | Notes |
|---|---|---|
| `subject` | string | required, 1–300 chars |
| `body` | string | required, 1–20 000 chars — stored as the first message, authored by the requester |
| `requesterEmail` | string | required, valid email |
| `requesterName` | string | optional, ≤200 chars |
| `priority` | string | optional — `low` / `normal` / `high` / `urgent`; anything else falls back to `normal` |
| `channel` | string | optional — `web` / `email` / `whatsapp` (default `whatsapp`) |

```bash
curl -X POST "https://suppuo.com/api/v1/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Tanya stok warna hitam",
    "body": "Customer called asking if the black variant is back in stock.",
    "requesterEmail": "siti@example.com",
    "requesterName": "Siti",
    "channel": "email",
    "priority": "normal"
  }'
```

Returns `201` with the full ticket object as `data`.

## Get a ticket

```
GET /api/v1/tickets/:id
```

Returns the ticket with its full `messages` thread (oldest first),
**including internal notes** — this is the agent view. Each message
carries its `attachments` metadata (`id`, `filename`, `contentType`,
`size`, `createdAt`); fetch the bytes via
[GET /api/v1/attachments/:id](/docs/attachments#download-agent).

```json
{
  "data": {
    "id": "tkt_01jx…",
    "number": 42,
    "status": "pending",
    "...": "…",
    "messages": [
      {
        "id": "tmsg_01jx…",
        "ticketId": "tkt_01jx…",
        "authorType": "requester",
        "authorSub": null,
        "authorName": "Budi",
        "body": "Resi belum muncul, sudah 2 hari.",
        "isInternal": false,
        "createdAt": "2026-06-11T03:21:09.000Z"
      },
      {
        "id": "tmsg_01jx…",
        "authorType": "agent",
        "authorSub": "usr_01hx…",
        "authorName": "Dewi",
        "body": "Checked with the courier — note for the team.",
        "isInternal": true,
        "createdAt": "2026-06-11T03:40:00.000Z"
      }
    ]
  },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T04:00:00.000Z" }
}
```

`404 NOT_FOUND` if the ticket doesn't exist in your workspace.

## Reply to a ticket

```
POST /api/v1/tickets/:id/messages
```

| Field | Type | Notes |
|---|---|---|
| `body` | string | required, 1–20 000 chars |
| `isInternal` | boolean | optional, default `false` — internal notes are agent-only |
| `authorName` | string | optional, ≤200 chars — shown to the requester ("Dewi replied…") |
| `attachmentIds` | string[] | optional, ≤5 — staged upload ids to attach; see [Attachments](/docs/attachments) |

A **public** reply (`isInternal: false`):

- moves the ticket to `pending` (unless it's `resolved`/`closed`),
- emails the requester (when the ticket has a `requesterEmail`) with
  the reply body and the status link,
- on a `whatsapp`-channel ticket with a `requesterPhone`, also delivers
  the reply over WhatsApp,
- on a `telegram`-channel ticket, also delivers the reply into the
  Telegram chat.

An **internal note** (`isInternal: true`) does none of that — it's
never emailed, never sent to WhatsApp or Telegram, never shown on the
public status page, and doesn't change the status.

```bash
curl -X POST "https://suppuo.com/api/v1/tickets/tkt_01jx…/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "body": "Halo Budi! Resi sudah kami update: JNE 1234567890.", "authorName": "Dewi" }'
```

```json
{
  "data": {
    "message": {
      "id": "tmsg_01jx…",
      "ticketId": "tkt_01jx…",
      "authorType": "agent",
      "authorSub": "usr_01hx…",
      "authorName": "Dewi",
      "body": "Halo Budi! Resi sudah kami update: JNE 1234567890.",
      "isInternal": false,
      "createdAt": "2026-06-11T04:05:00.000Z"
    },
    "status": "pending"
  },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T04:05:00.000Z" }
}
```

`data.status` is the ticket's status **after** the message landed.

## Update a ticket

```
PATCH /api/v1/tickets/:id
```

| Field | Type | Notes |
|---|---|---|
| `status` | string | `open` / `pending` / `resolved` / `closed` |
| `priority` | string | `low` / `normal` / `high` / `urgent` |
| `assigneeSub` | string or `null` | assign to an agent's Huudis sub; `null` unassigns |
| `tags` | string[] | **replaces** the ticket's tags — pass the full list. Normalized server-side (trimmed, lowercased, deduped); `[]` clears. Max 10 tags × 40 chars. |

At least one field is required — an empty body returns
`400 VALIDATION_ERROR` ("nothing to update"), as does an invalid
`status` or `priority` value, or a tag list over the limits.

```bash
curl -X PATCH "https://suppuo.com/api/v1/tickets/tkt_01jx…" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "resolved", "tags": ["pengiriman", "selesai"] }'
```

Returns `200` with the updated ticket object. Setting `status` to
`resolved` triggers the [CSAT survey](/docs/automation-csat#csat-surveys)
(once per ticket, when the requester has an email).

## See also

- [Hosted support form](/docs/public-form) — the unauthenticated
  surface customers use.
- [Attachments](/docs/attachments) — uploading files and attaching
  them to messages.
- [API authentication](/docs/api-auth) — tokens, envelope, error
  codes.

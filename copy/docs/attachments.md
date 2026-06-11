---
title: "Attachments"
---

# Attachments

Foto resi, screenshot error, PDF invoice — file ikut nempel di tiket.
Ticket messages can carry **file attachments** on every surface: the
agent inbox, the hosted status page, the live chat widget, and inbound
WhatsApp media. This page documents the rules and the API.

## The rules (all surfaces)

- **8MB per file**, up to **5 files per message**.
- Allowed types: images (`png`, `jpeg`, `gif`, `webp`), `pdf`, `txt`,
  `csv`, `docx`, `xlsx`, `zip`. Executables are rejected — both by
  content type and by file extension, even inside an allowed content
  type.
- Images are served **inline** (previews); everything else downloads
  as an attachment.
- Internal-note attachments are **never** visible on any public
  surface.

## Upload → attach: the two-step flow

Attachments are **staged first, then bound** to a message:

1. `POST` the raw file bytes to the upload endpoint → you get back an
   attachment `id`.
2. Pass that id in `attachmentIds` when you
   [create the message](/docs/tickets#reply-to-a-ticket) — the bind
   happens in the same transaction as the message.

Staged uploads you never attach are swept automatically after
**1 hour**.

### Stage an upload (agent)

```
POST /api/v1/attachments
```

The body is the **raw file bytes** (not multipart, not JSON), with two
headers doing the work:

| Header | Notes |
|---|---|
| `Content-Type` | the file's real type — checked against the allowlist |
| `X-Filename` | the filename (URI-encode non-ASCII names) |

```bash
curl -X POST "https://suppuo.com/api/v1/attachments" \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: image/png" \
  -H "X-Filename: bukti-transfer.png" \
  --data-binary @bukti-transfer.png
```

```json
{
  "data": {
    "id": "att_01jx2v9k3m8q4r5s6t7u8v9w0x",
    "filename": "bukti-transfer.png",
    "contentType": "image/png",
    "size": 482133,
    "createdAt": "2026-06-11T03:21:09.000Z"
  },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T03:21:09.000Z" }
}
```

Oversized files get `413`; a disallowed type or a blocked extension
gets `400 VALIDATION_ERROR` with a plain-English message.

### Bind to a message

```bash
curl -X POST "https://suppuo.com/api/v1/tickets/tkt_01jx…/messages" \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Ini bukti transfernya ya.",
    "attachmentIds": ["att_01jx2v9k3m8q4r5s6t7u8v9w0x"]
  }'
```

Binding validates everything again: an unknown id, an id from another
workspace, or an id that's already attached to a message all fail the
whole request with `400 VALIDATION_ERROR` — a message is never
created with half its attachments.

### Download (agent)

```
GET /api/v1/attachments/:id
```

Account-scoped — agents can fetch any attachment in their workspace,
including ones on internal notes. Ticket and message payloads carry
attachment **metadata only** (`id`, `filename`, `contentType`,
`size`, `createdAt`); fetch the bytes from this endpoint.

## The public (requester) surface

The status page and the [widget](/docs/live-chat-widget) use
token-scoped twins of the same endpoints — no API key, the ticket's
access token is the credential:

```
POST /api/v1/public/tickets/:accessToken/attachments
GET  /api/v1/public/tickets/:accessToken/attachments/:id
```

Upload works exactly like the agent endpoint (raw bytes +
`X-Filename`); pass the returned ids as `attachmentIds` on the
[requester reply](/docs/public-form#requester-reply). Downloads are
strictly scoped: the token only ever serves attachments bound to a
**public** message of **that** ticket — staged uploads and
internal-note files are never reachable here.

## Channel media: WhatsApp

Inbound WhatsApp media on a **Twilio**-connected number (photos,
voice notes, videos, documents) is fetched from Twilio and stored as
attachments on the inbound message automatically — a customer who
sends only a photo produces a message like `[attachment: photo-1.jpg]`
with the file attached. Channel media accepts a few extra types
browsers can't upload directly (`ogg`/`mp3`/`m4a`/`amr` audio,
`mp4`/`3gp` video).

Honestly: **WhatsApp Cloud API and Telegram inbound media aren't
stored yet** — those channels are text-first for now. Outbound agent
attachments are also not pushed over WhatsApp/Telegram or attached to
notification emails; the customer views and downloads them on their
status page (or in the widget).

## See also

- [Tickets API](/docs/tickets) — the message-create endpoints that
  accept `attachmentIds`.
- [Hosted support form](/docs/public-form) — the public surface.
- [Live chat widget](/docs/live-chat-widget) — attachments in the
  chat bubble.

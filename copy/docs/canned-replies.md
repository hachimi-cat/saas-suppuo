---
title: "Canned replies"
---

# Canned replies

Pertanyaan yang sama datang berulang kali — "kapan dikirim?", "bisa
COD?", "cara retur gimana?". Canned replies let you save your best
answers once and insert them into any reply with one click.

Canned replies are per-workspace: every agent on the team shares the
same library.

## In the portal

- **Manage** them under **Settings → Canned replies**: add a new one
  (title + body), or delete ones you've outgrown.
- **Use** them from any ticket: when your workspace has at least one
  canned reply, the reply box shows an **"Insert canned reply…"**
  dropdown. Picking one inserts its body into the reply box — edit it
  to fit, then send. Nothing is sent automatically.

Keep the title short and recognizable (`Resi / tracking`, `Retur`,
`Jam operasional`) — that's what you scan for in the dropdown.

## API

All endpoints require [authentication](/docs/api-auth) and use the
standard envelope. The canned reply object:

```json
{
  "id": "cnr_01jx2v9k3m8q4r5s6t7u8v9w0x",
  "accountId": "acc_5f1e2d3c4b5a69788796a5b4",
  "title": "Resi / tracking",
  "body": "Halo! Resi pesanan Anda: {{nomor}}. Cek status di situs kurir ya. Terima kasih!",
  "createdAt": "2026-06-11T03:00:00.000Z",
  "updatedAt": "2026-06-11T03:00:00.000Z"
}
```

(Heads-up: `{{nomor}}` above is just a writing convention for the
human agent to fill in — Suppuo doesn't do template-variable
substitution.)

### List

```
GET /api/v1/canned-replies
```

Returns all of the workspace's canned replies, sorted by title.

```json
{
  "data": { "cannedReplies": [ { "id": "cnr_01jx…", "title": "Resi / tracking", "...": "…" } ] },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T03:05:00.000Z" }
}
```

### Create

```
POST /api/v1/canned-replies
```

| Field | Type | Notes |
|---|---|---|
| `title` | string | required, 1–120 chars |
| `body` | string | required, 1–20 000 chars |

```bash
curl -X POST "https://suppuo.com/api/v1/canned-replies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Jam operasional", "body": "Halo! Kami online Senin–Sabtu 09.00–17.00 WIB." }'
```

Returns `201` with the created object.

### Update

```
PATCH /api/v1/canned-replies/:id
```

Send `title` and/or `body` (same limits as create). Returns `200` with
the updated object; `404 NOT_FOUND` if the ID isn't in your workspace.

### Delete

```
DELETE /api/v1/canned-replies/:id
```

Returns `200` with `{ "deleted": true }`; `404 NOT_FOUND` if the ID
isn't in your workspace.

## See also

- [Tickets API](/docs/tickets#reply-to-a-ticket) — sending the reply a
  canned snippet was inserted into.

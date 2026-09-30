---
title: Tickets — reference
---

# Tickets

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/tickets` | [List tickets](#list-tickets) |
| `POST` | `/api/v1/tickets` | [Agent-created ticket (logging an inquiry that arrived out-of-band, e.g.](#agent-created-ticket-logging-an-inquiry-that-arrived-out-of-band-eg) |
| `GET` | `/api/v1/tickets/{id}` | [Get a ticket](#get-a-ticket) |
| `PATCH` | `/api/v1/tickets/{id}` | [Update a ticket](#update-a-ticket) |
| `POST` | `/api/v1/tickets/{id}/messages` | [Messages a ticket](#messages-a-ticket) |
| `GET` | `/api/v1/tickets/tags` | [Distinct tags across the workspace's tickets — autocomplete feed.](#distinct-tags-across-the-workspaces-tickets-autocomplete-feed) |

## List tickets

```
GET /api/v1/tickets
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `status` | `open` or `pending` or `resolved` or `closed` or `all` | no |  |
| `assignee` | string | no | min length 1; max length 200 |
| `tag` | string | no | min length 1; max length 40 |
| `channel` | `web` or `email` or `whatsapp` or `telegram` | no |  |
| `priority` | `low` or `normal` or `high` or `urgent` | no |  |
| `q` | string | no | max length 200 |
| `limit` | integer | no | min 1; max 100 |
| `cursor` | string | no |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/tickets" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Agent-created ticket (logging an inquiry that arrived out-of-band, e.g.

```
POST /api/v1/tickets
```

Agent-created ticket (logging an inquiry that arrived out-of-band,
 e.g. WhatsApp). The requester still gets the status-link email.

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `subject` | string | yes | min length 1; max length 300 |
| `body` | string | yes | min length 1; max length 20000 |
| `requesterEmail` | string (email) | yes |  |
| `requesterName` | string | no | max length 200 |
| `priority` | string | no |  |
| `channel` | `web` or `email` or `whatsapp` | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/tickets" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"subject":"…","body":"…","requesterEmail":"…","requesterName":"…","priority":"…","channel":"web"}'
```

## Get a ticket

```
GET /api/v1/tickets/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/tickets/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Update a ticket

```
PATCH /api/v1/tickets/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | string | no |  |
| `priority` | string | no |  |
| `assigneeSub` | string | no | may be null |
| `tags` | array of string | no |  |

### Example

```bash
curl -X PATCH "https://suppuo.com/api/v1/tickets/:id" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"status":"…","priority":"…","assigneeSub":"…","tags":[]}'
```

## Messages a ticket

```
POST /api/v1/tickets/{id}/messages
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `body` | string | yes | min length 1; max length 20000 |
| `isInternal` | boolean | no |  |
| `authorName` | string | no | max length 200 |
| `attachmentIds` | array of string | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/tickets/:id/messages" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"body":"…","isInternal":false,"authorName":"…","attachmentIds":[]}'
```

## Distinct tags across the workspace's tickets — autocomplete feed.

```
GET /api/v1/tickets/tags
```

Distinct tags across the workspace's tickets — autocomplete feed.
 (Must be mounted before /:id so 'tags' isn't read as a ticket id.)

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/tickets/tags" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

---
title: Requester — reference
---

# Requester

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/requester/me` | [List me](#list-me) |
| `GET` | `/api/v1/requester/tickets` | [List tickets](#list-tickets) |
| `POST` | `/api/v1/requester/tickets` | [Create a ticket](#create-a-ticket) |
| `GET` | `/api/v1/requester/tickets/{number}` | [Get a ticket](#get-a-ticket) |
| `POST` | `/api/v1/requester/tickets/{number}/messages` | [Messages a ticket](#messages-a-ticket) |

## List me

```
GET /api/v1/requester/me
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/requester/me" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## List tickets

```
GET /api/v1/requester/tickets
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `status` | `open` or `resolved` or `all` | no | default `"all"` |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/requester/tickets" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Create a ticket

```
POST /api/v1/requester/tickets
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `subject` | string | yes | min length 1; max length 300 |
| `body` | string | yes | min length 1; max length 20000 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/requester/tickets" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"subject":"…","body":"…"}'
```

## Get a ticket

```
GET /api/v1/requester/tickets/{number}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `number` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/requester/tickets/:number" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Messages a ticket

```
POST /api/v1/requester/tickets/{number}/messages
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `number` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `body` | string | yes | min length 1; max length 20000 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/requester/tickets/:number/messages" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"body":"…"}'
```

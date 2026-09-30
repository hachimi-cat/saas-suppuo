---
title: Canned replies — reference
---

# Canned replies

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/canned-replies` | [List canned replies](#list-canned-replies) |
| `POST` | `/api/v1/canned-replies` | [Create a canned reply](#create-a-canned-reply) |
| `DELETE` | `/api/v1/canned-replies/{id}` | [Delete a canned reply](#delete-a-canned-reply) |
| `PATCH` | `/api/v1/canned-replies/{id}` | [Update a canned reply](#update-a-canned-reply) |

## List canned replies

```
GET /api/v1/canned-replies
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/canned-replies" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Create a canned reply

```
POST /api/v1/canned-replies
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | min length 1; max length 120 |
| `body` | string | yes | min length 1; max length 20000 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/canned-replies" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"title":"…","body":"…"}'
```

## Delete a canned reply

```
DELETE /api/v1/canned-replies/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://suppuo.com/api/v1/canned-replies/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Update a canned reply

```
PATCH /api/v1/canned-replies/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | no | min length 1; max length 120 |
| `body` | string | no | min length 1; max length 20000 |

### Example

```bash
curl -X PATCH "https://suppuo.com/api/v1/canned-replies/:id" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"title":"…","body":"…"}'
```

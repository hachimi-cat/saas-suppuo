---
title: Attachments — reference
---

# Attachments

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/attachments` | [Create an attachment](#create-an-attachment) |
| `GET` | `/api/v1/attachments/{id}` | [Get an attachment](#get-an-attachment) |

## Create an attachment

```
POST /api/v1/attachments
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `length` | any | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/attachments" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"length":null}'
```

## Get an attachment

```
GET /api/v1/attachments/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/attachments/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

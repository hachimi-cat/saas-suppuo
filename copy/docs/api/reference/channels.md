---
title: Channels — reference
---

# Channels

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/channels` | [List channels](#list-channels) |
| `POST` | `/api/v1/channels` | [Create a channel](#create-a-channel) |
| `DELETE` | `/api/v1/channels/{id}` | [Delete a channel](#delete-a-channel) |

## List channels

```
GET /api/v1/channels
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/channels" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Create a channel

```
POST /api/v1/channels
```

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/channels" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Delete a channel

```
DELETE /api/v1/channels/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://suppuo.com/api/v1/channels/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

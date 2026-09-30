---
title: Profile — reference
---

# Profile

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `DELETE` | `/api/v1/profile/avatar` | [Delete avatar](#delete-avatar) |
| `PUT` | `/api/v1/profile/avatar` | [Set avatar](#set-avatar) |
| `GET` | `/api/v1/profile/avatar/{sub}` | [Get an avatar](#get-an-avatar) |

## Delete avatar

```
DELETE /api/v1/profile/avatar
```

### Example

```bash
curl -X DELETE "https://suppuo.com/api/v1/profile/avatar" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Set avatar

```
PUT /api/v1/profile/avatar
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `length` | any | no |  |

### Example

```bash
curl -X PUT "https://suppuo.com/api/v1/profile/avatar" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"length":null}'
```

## Get an avatar

```
GET /api/v1/profile/avatar/{sub}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `sub` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/profile/avatar/:sub" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

---
title: Domains — reference
---

# Domains

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/domains` | [List domains](#list-domains) |
| `POST` | `/api/v1/domains` | [Create a domain](#create-a-domain) |
| `DELETE` | `/api/v1/domains/{id}` | [Delete a domain](#delete-a-domain) |
| `POST` | `/api/v1/domains/{id}/verify` | [Verify a domain](#verify-a-domain) |

## List domains

```
GET /api/v1/domains
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/domains" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Create a domain

```
POST /api/v1/domains
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `domain` | string | yes | min length 3; max length 253 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/domains" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"domain":"…"}'
```

## Delete a domain

```
DELETE /api/v1/domains/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://suppuo.com/api/v1/domains/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Verify a domain

```
POST /api/v1/domains/{id}/verify
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/domains/:id/verify" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

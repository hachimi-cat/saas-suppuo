---
title: Help — reference
---

# Help

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/help/articles` | [List articles](#list-articles) |
| `POST` | `/api/v1/help/articles` | [Create an article](#create-an-article) |
| `DELETE` | `/api/v1/help/articles/{id}` | [Delete an article](#delete-an-article) |
| `GET` | `/api/v1/help/articles/{id}` | [Get an article](#get-an-article) |
| `PATCH` | `/api/v1/help/articles/{id}` | [Update an article](#update-an-article) |

## List articles

```
GET /api/v1/help/articles
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/help/articles" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Create an article

```
POST /api/v1/help/articles
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | `faq` or `article` | no | default `"faq"` |
| `slug` | string | no | max length 120 |
| `category` | string | no | max length 80; may be null |
| `title` | string | yes | min length 1; max length 300 |
| `body` | string | yes | min length 1; max length 50000 |
| `status` | `draft` or `published` | no | default `"draft"` |
| `position` | integer | no | min 0; max 100000 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/help/articles" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"faq","slug":"…","category":"…","title":"…","body":"…","status":"draft","position":0}'
```

## Delete an article

```
DELETE /api/v1/help/articles/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X DELETE "https://suppuo.com/api/v1/help/articles/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Get an article

```
GET /api/v1/help/articles/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/help/articles/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Update an article

```
PATCH /api/v1/help/articles/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | `faq` or `article` | no |  |
| `slug` | string | no | max length 120; may be null |
| `category` | string | no | max length 80; may be null |
| `title` | string | no | min length 1; max length 300 |
| `body` | string | no | min length 1; max length 50000 |
| `status` | `draft` or `published` | no |  |
| `position` | integer | no | min 0; max 100000 |

### Example

```bash
curl -X PATCH "https://suppuo.com/api/v1/help/articles/:id" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"faq","slug":"…","category":"…","title":"…","body":"…","status":"draft","position":0}'
```

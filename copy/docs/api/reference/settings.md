---
title: Settings — reference
---

# Settings

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/settings/automation` | [List automation](#list-automation) |
| `PUT` | `/api/v1/settings/automation` | [Set automation](#set-automation) |
| `GET` | `/api/v1/settings/branding` | [List branding](#list-branding) |
| `PUT` | `/api/v1/settings/branding` | [Set branding](#set-branding) |
| `DELETE` | `/api/v1/settings/branding/logo` | [Delete logo](#delete-logo) |
| `POST` | `/api/v1/settings/branding/logo` | [Create a logo](#create-a-logo) |
| `GET` | `/api/v1/settings/help` | [List help](#list-help) |
| `PUT` | `/api/v1/settings/help` | [Set help](#set-help) |

## List automation

```
GET /api/v1/settings/automation
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/settings/automation" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Set automation

```
PUT /api/v1/settings/automation
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `businessHours` | object | no | may be null |
| `autoResponseEnabled` | boolean | no |  |
| `autoResponseInside` | string | no | max length 5000; may be null |
| `autoResponseOutside` | string | no | max length 5000; may be null |
| `hideBranding` | boolean | no |  |

### Example

```bash
curl -X PUT "https://suppuo.com/api/v1/settings/automation" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"businessHours":{"tz":"…","days":[]},"autoResponseEnabled":false,"autoResponseInside":"…","autoResponseOutside":"…","hideBranding":false}'
```

## List branding

```
GET /api/v1/settings/branding
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/settings/branding" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Set branding

```
PUT /api/v1/settings/branding
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | no | max length 40; may be null |
| `brandName` | string | no | max length 80; may be null |
| `brandLogoUrl` | string | no | max length 500; may be null |
| `accentColor` | string or `` | no | may be null |
| `brandColor` | string or `` | no | may be null |
| `widgetTextColor` | string or `` | no | may be null |

### Example

```bash
curl -X PUT "https://suppuo.com/api/v1/settings/branding" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"slug":"…","brandName":"…","brandLogoUrl":"…","accentColor":null,"brandColor":null,"widgetTextColor":null}'
```

## Delete logo

```
DELETE /api/v1/settings/branding/logo
```

### Example

```bash
curl -X DELETE "https://suppuo.com/api/v1/settings/branding/logo" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Create a logo

```
POST /api/v1/settings/branding/logo
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `length` | any | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/settings/branding/logo" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"length":null}'
```

## List help

```
GET /api/v1/settings/help
```

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/settings/help" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Set help

```
PUT /api/v1/settings/help
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `contactEmail` | string (email) or `` | no | may be null |
| `contactPhone` | string | no | max length 40; may be null |
| `contactAddress` | string | no | max length 500; may be null |
| `docsUrl` | string | no | max length 500; may be null |
| `contactUrl` | string | no | max length 500; may be null |
| `helpIntro` | string | no | max length 280; may be null |

### Example

```bash
curl -X PUT "https://suppuo.com/api/v1/settings/help" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"contactEmail":null,"contactPhone":"…","contactAddress":"…","docsUrl":"…","contactUrl":"…","helpIntro":"…"}'
```

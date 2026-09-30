---
title: Reports — reference
---

# Reports

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/reports/summary` | [List summary](#list-summary) |

## List summary

```
GET /api/v1/reports/summary
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `days` | any | no |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/reports/summary" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

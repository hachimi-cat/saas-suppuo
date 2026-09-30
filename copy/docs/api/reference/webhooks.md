---
title: Webhooks — reference
---

# Webhooks

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/webhooks/telegram/{integrationId}` | [Act on a telegram](#act-on-a-telegram) |
| `POST` | `/api/v1/webhooks/twilio/whatsapp` | [Create a whatsapp](#create-a-whatsapp) |
| `GET` | `/api/v1/webhooks/whatsapp-cloud` | [GET — subscription verification handshake.](#get-subscription-verification-handshake) |

## Act on a telegram

```
POST /api/v1/webhooks/telegram/{integrationId}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `integrationId` | string | yes |  |

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `secret` | any | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/webhooks/telegram/:integrationId" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Create a whatsapp

```
POST /api/v1/webhooks/twilio/whatsapp
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `secret` | any | no |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `Body` | any | no |  |
| `From` | any | no |  |
| `NumMedia` | any | no |  |
| `ProfileName` | any | no |  |
| `To` | any | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/webhooks/twilio/whatsapp" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"Body":null,"From":null,"NumMedia":null,"ProfileName":null,"To":null}'
```

## GET — subscription verification handshake.

```
GET /api/v1/webhooks/whatsapp-cloud
```

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `hub.challenge` | any | no |  |
| `hub.mode` | any | no |  |
| `hub.verify_token` | any | no |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/webhooks/whatsapp-cloud" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

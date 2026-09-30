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

### Body

The body takes one of several shapes; these are the fields of all of them.

| Field | Type | Required | Notes |
|---|---|---|---|
| `provider` | `whatsapp_twilio` or `whatsapp_cloud` or `email_resend` or `telegram_bot` or `slack_webhook` or `discord_webhook` | no |  |
| `accountSid` | string | no |  |
| `authToken` | string | no | min length 16 |
| `whatsappNumber` | string | no |  |
| `displayName` | string | no | max length 120 |
| `accessToken` | string | no | min length 16 |
| `phoneNumberId` | string | no |  |
| `wabaId` | string | no |  |
| `displayNumber` | string | no |  |
| `verifyToken` | string | no | min length 8; max length 128 |
| `appSecret` | string | no | min length 8; max length 128 |
| `apiKey` | string | no | min length 8 |
| `fromEmail` | string (email) | no |  |
| `fromName` | string | no | max length 120 |
| `botToken` | string | no |  |
| `webhookUrl` | string (uri) | no | max length 500 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/channels" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"provider":"whatsapp_twilio","accountSid":"…","authToken":"…","whatsappNumber":"…","displayName":"…","accessToken":"…","phoneNumberId":"…","wabaId":"…","displayNumber":"…","verifyToken":"…","appSecret":"…","apiKey":"…","fromEmail":"…","fromName":"…","botToken":"…","webhookUrl":"…"}'
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

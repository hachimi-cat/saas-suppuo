---
title: Public — reference
---

# Public

Generated from Suppuo's own code: every route in this area, what it takes and how to call it.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/public/domains/provision-callback` | [Create a provision callback](#create-a-provision-callback) |
| `GET` | `/api/v1/public/domains/resolve` | [Host → accountId — used by the frontend middleware to route a custom domain's request to the right workspace.](#host-accountid-used-by-the-frontend-middleware-to-route-a-custom-domains-request-to-the-right-workspace) |
| `GET` | `/api/v1/public/help/{accountId}` | [The help-center bundle.](#the-help-center-bundle) |
| `GET` | `/api/v1/public/help/{accountId}/a/{slug}` | [A single published article.](#a-single-published-article) |
| `GET` | `/api/v1/public/help/{accountId}/branding` | [Public branding (logo + colors + name) for the help center AND the hosted portal's pre-auth screen.](#public-branding-logo-colors-name-for-the-help-center-and-the-hosted-portals-pre-auth-screen) |
| `GET` | `/api/v1/public/help/{accountId}/logo` | [Serve the uploaded brand logo bytes.](#serve-the-uploaded-brand-logo-bytes) |
| `GET` | `/api/v1/public/help/{accountId}/search` | [List search](#list-search) |
| `POST` | `/api/v1/public/requester/verify` | [Create a verify](#create-a-verify) |
| `POST` | `/api/v1/public/tickets` | [Create a ticket](#create-a-ticket) |
| `GET` | `/api/v1/public/tickets/{accessToken}` | [Tokenized status view — public messages only, no internal notes.](#tokenized-status-view-public-messages-only-no-internal-notes) |
| `POST` | `/api/v1/public/tickets/{accessToken}/attachments` | [Attachments a ticket](#attachments-a-ticket) |
| `GET` | `/api/v1/public/tickets/{accessToken}/attachments/{id}` | [Get an attachment](#get-an-attachment) |
| `POST` | `/api/v1/public/tickets/{accessToken}/csat` | [Csat a ticket](#csat-a-ticket) |
| `POST` | `/api/v1/public/tickets/{accessToken}/messages` | [Messages a ticket](#messages-a-ticket) |
| `GET` | `/api/v1/public/widget-config` | [Pre-ticket config for the embeddable widget + hosted form (the branding footer renders before any ticket exists).](#pre-ticket-config-for-the-embeddable-widget-hosted-form-the-branding-footer-renders-before-any-ticket-exists) |

## Create a provision callback

```
POST /api/v1/public/domains/provision-callback
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `domain` | string | yes |  |
| `status` | `success` or `failed` | yes |  |
| `error` | string | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/public/domains/provision-callback" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"domain":"…","status":"success","error":"…"}'
```

## Host → accountId — used by the frontend middleware to route a custom domain's request to the right workspace.

```
GET /api/v1/public/domains/resolve
```

Host → accountId — used by the frontend middleware to route a custom
domain's request to the right workspace. Returns null for Suppuo hosts /
unknown domains.

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `host` | any | no |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/domains/resolve" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## The help-center bundle.

```
GET /api/v1/public/help/{accountId}
```

GET /public/help/:accountId — the help-center bundle.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accountId` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/help/:accountId" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## A single published article.

```
GET /api/v1/public/help/{accountId}/a/{slug}
```

GET /public/help/:accountId/a/:slug — a single published article.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accountId` | string | yes |  |
| `slug` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/help/:accountId/a/:slug" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Public branding (logo + colors + name) for the help center AND the hosted portal's pre-auth screen.

```
GET /api/v1/public/help/{accountId}/branding
```

GET /public/help/:accountId/branding — public branding (logo + colors +
name) for the help center AND the hosted portal's pre-auth screen.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accountId` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/help/:accountId/branding" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Serve the uploaded brand logo bytes.

```
GET /api/v1/public/help/{accountId}/logo
```

GET /public/help/:accountId/logo — serve the uploaded brand logo bytes.

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accountId` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/help/:accountId/logo" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## List search

```
GET /api/v1/public/help/{accountId}/search
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accountId` | string | yes |  |

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `q` | string | no | default `""`; max length 200 |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/help/:accountId/search" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Create a verify

```
POST /api/v1/public/requester/verify
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `token` | string | yes | min length 10; max length 2000 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/public/requester/verify" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"token":"…"}'
```

## Create a ticket

```
POST /api/v1/public/tickets
```

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `accountId` | string | yes | min length 3; max length 64 |
| `subject` | string | yes | min length 1; max length 300 |
| `body` | string | yes | min length 1; max length 20000 |
| `email` | string (email) | yes |  |
| `name` | string | no | max length 200 |
| `company` | string | no | max length 300 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/public/tickets" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"…","subject":"…","body":"…","email":"…","name":"…","company":"…"}'
```

## Tokenized status view — public messages only, no internal notes.

```
GET /api/v1/public/tickets/{accessToken}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accessToken` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/tickets/:accessToken" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Attachments a ticket

```
POST /api/v1/public/tickets/{accessToken}/attachments
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accessToken` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `length` | any | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/public/tickets/:accessToken/attachments" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"length":null}'
```

## Get an attachment

```
GET /api/v1/public/tickets/{accessToken}/attachments/{id}
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accessToken` | string | yes |  |
| `id` | string | yes |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/tickets/:accessToken/attachments/:id" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

## Csat a ticket

```
POST /api/v1/public/tickets/{accessToken}/csat
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accessToken` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `score` | integer | yes | min 1; max 3 |
| `comment` | string | no | max length 2000 |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/public/tickets/:accessToken/csat" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"score":1,"comment":"…"}'
```

## Messages a ticket

```
POST /api/v1/public/tickets/{accessToken}/messages
```

### Path parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `accessToken` | string | yes |  |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `body` | string | yes | min length 1; max length 20000 |
| `attachmentIds` | array of string | no |  |

### Example

```bash
curl -X POST "https://suppuo.com/api/v1/public/tickets/:accessToken/messages" \
  -H "Authorization: Bearer sk_live_<your API key>" \
  -H "Content-Type: application/json" \
  -d '{"body":"…","attachmentIds":[]}'
```

## Pre-ticket config for the embeddable widget + hosted form (the branding footer renders before any ticket exists).

```
GET /api/v1/public/widget-config
```

Pre-ticket config for the embeddable widget + hosted form (the
 branding footer renders before any ticket exists). No secrets.

### Query parameters

| Name | Type | Required | Notes |
|---|---|---|---|
| `account` | any | no |  |

### Example

```bash
curl -X GET "https://suppuo.com/api/v1/public/widget-config" \
  -H "Authorization: Bearer sk_live_<your API key>"
```

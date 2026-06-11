---
title: "Channels"
---

# Channels

Channel adalah pintu masuk pelanggan ke inbox Anda — form, email,
WhatsApp. A **channel** is where a customer conversation enters your
workspace. Every channel lands in the same inbox as a ticket; this
page explains which channels exist, which are live, and how to bring
your own provider accounts.

Manage everything at [/dashboard/channels](/dashboard/channels).

## Always-on channels

These work for every workspace from day one, no setup:

- **Hosted support form** — customers submit tickets at your form URL
  (find it in Settings), and replies go out by email with a private
  status link. See [Hosted support form](/docs/public-form).
- **Manual logging** — log requests that arrive anywhere else (phone,
  DM, walk-in) with the **New ticket** button in the inbox, or via
  [POST /api/v1/tickets](/docs/tickets#create-a-ticket). The customer
  still gets the email status link.

## Platform channels

Channels Suppuo provides on shared infrastructure:

- **Email notifications** — **live**. Outbound ticket updates to
  requesters are sent via Resend from a `suppuo.forjio.com` address by
  default. Want them from your own domain? Connect your own Resend
  account below. See [Email notifications](/docs/email-notifications).
- **WhatsApp platform number** — **pending**. A shared Suppuo
  WhatsApp number is awaiting WhatsApp approval. Until it's live, the
  WhatsApp channel works today by bringing your own Twilio number
  (below) — which is also the better deal: unlimited messages, your
  own number.

## Bring your own provider (BYO)

A workspace can connect its **own** provider accounts. Credentials
are validated **live against the provider** before the integration
activates — a typo'd Twilio token or revoked Resend key is rejected
with a `400` on the spot, never stored broken. Accepted credentials
are stored **encrypted (AES-256-GCM)** and are never returned by any
API response after creation.

### WhatsApp via your own Twilio (`whatsapp_twilio`)

Connect your own Twilio account and WhatsApp-enabled number. Because
the messages flow through *your* Twilio account, there is **no Suppuo
message metering — unlimited messages**; you pay Twilio directly for
what you use.

You need three things from the
[Twilio Console](https://console.twilio.com):

- **Account SID** — starts with `AC`,
- **Auth token**,
- your **WhatsApp number** in E.164 format (e.g. `+62812…`).

Connect them in [/dashboard/channels](/dashboard/channels) → WhatsApp
→ **Connect your Twilio**, or via the API:

```bash
curl -X POST https://suppuo.com/api/v1/channels \
  -H "Authorization: Bearer sk_live_…" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "whatsapp_twilio",
    "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "authToken": "your-twilio-auth-token",
    "whatsappNumber": "+62812xxxxxxx"
  }'
```

**One manual step remains** — Twilio has to know where to deliver
inbound messages. The create response includes a `webhookUrl`:

```json
{
  "webhookUrl": "https://suppuo.com/api/v1/webhooks/twilio/whatsapp?secret=…",
  "note": "Point your Twilio number's incoming-message webhook at webhookUrl (POST)."
}
```

In the Twilio Console, open your WhatsApp number → **Messaging** →
*"A message comes in"* → set it to **Webhook (POST)** with that URL.
The portal shows the same URL and instructions right after you
connect. From then on, messages to your number become tickets and
agent replies are sent from your number through your Twilio account.

Reconnecting the same number (e.g. after rotating your auth token)
simply refreshes the stored credentials — no need to disconnect first.

### Email via your own Resend (`email_resend`)

Connect your own [Resend](https://resend.com) API key and a from
address on a domain you've verified with Resend. Requester
notifications for your workspace then send from *your* address
instead of the platform default:

```bash
curl -X POST https://suppuo.com/api/v1/channels \
  -H "Authorization: Bearer sk_live_…" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "email_resend",
    "apiKey": "re_…",
    "fromEmail": "support@yourstore.com",
    "fromName": "Toko Anda"
  }'
```

## How inbound routing works

WhatsApp is multi-tenant: Suppuo decides which workspace owns an
inbound message by the **receiving number**. A message to a number
connected as a BYO Twilio integration routes to that integration's
workspace (and replies go back out through that workspace's own
Twilio credentials); a message to the shared platform number (once
live) routes to the workspace it's assigned to. One number belongs to
exactly one workspace.

## Managing integrations

- `GET /api/v1/channels` — list your workspace's integrations
  (credentials are **never** included) plus which platform channels
  are live.
- `POST /api/v1/channels` — connect (or refresh) an integration, as
  above.
- `DELETE /api/v1/channels/:id` — disconnect. Also available from the
  portal. After disconnecting a Twilio integration, messages to that
  number no longer reach your inbox.

## Coming soon — honestly, not yet

These show as "Coming soon" in the portal because they don't work
yet:

- **WhatsApp Cloud API (Meta direct)** — connect a Meta WhatsApp
  Business account without Twilio in between.
- **Live chat widget** — an embeddable chat bubble that opens tickets
  in this inbox.
- **Email-to-ticket (inbound)** — a `support@` address that turns
  incoming email into tickets. (Today email is outbound-only —
  notifications with status links.)

## See also

- [WhatsApp (beta)](/docs/whatsapp) — how WA messages thread into
  tickets.
- [Email notifications](/docs/email-notifications) — what requesters
  receive.
- [API keys](/docs/api-keys) — the `sk_live_…` tokens used in the
  examples above.

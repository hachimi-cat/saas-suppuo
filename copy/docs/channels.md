---
title: "Channels"
---

# Channels

Channel adalah pintu masuk pelanggan ke inbox Anda — form, live chat,
email, WhatsApp, Telegram. A **channel** is where a customer
conversation enters your workspace. Every channel lands in the same
inbox as a ticket; this page explains which channels exist and walks
through connecting each one.

Manage everything at [/dashboard/channels](/dashboard/channels).

## Always-on channels

These work for every workspace from day one, no setup:

- **Hosted support form** — customers submit tickets at your form URL
  (find it in Settings), and replies go out by email with a private
  status link. See [Hosted support form](/docs/public-form).
- **Live chat widget** — one `<script>` tag puts a chat bubble on your
  own website; visitor messages open tickets in this inbox. See
  [Live chat widget](/docs/live-chat-widget).
- **Email-to-ticket** — every workspace owns an inbound address
  `<accountId>@in.suppuo.com`; forward your `support@` to it and every
  email becomes a ticket, with replies threading both ways. See
  [Email-to-ticket](/docs/email-to-ticket).
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
  WhatsApp channel works today by bringing your own number — via
  Twilio or via Meta's Cloud API directly (both below) — which is also
  the better deal: unlimited messages, your own number.

## Bring your own provider (BYO)

A workspace can connect its **own** provider accounts — six providers:

| Provider | What it does |
|---|---|
| `whatsapp_twilio` | Two-way WhatsApp on your own Twilio number |
| `whatsapp_cloud` | Two-way WhatsApp via Meta's Cloud API — no Twilio in between |
| `email_resend` | Requester emails sent from your own domain |
| `telegram_bot` | Two-way Telegram via your own bot |
| `slack_webhook` | Team notifications into a Slack channel |
| `discord_webhook` | Team notifications into a Discord channel |

Credentials are validated **live against the provider** before the
integration activates — a typo'd Twilio token, a revoked Resend key,
or a dead Slack webhook is rejected with a `400` on the spot, never
stored broken. Accepted credentials are stored **encrypted
(AES-256-GCM)** and are never returned by any API response after
creation.

Each provider can be connected from the portal at
[/dashboard/channels](/dashboard/channels) or via
`POST /api/v1/channels`, as below.

### WhatsApp via your own Twilio

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
  -H "Authorization: Bearer sk_live_xxx" \
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

### WhatsApp Cloud API — Meta direct

Connect a Meta WhatsApp Business account **directly**, no Twilio in
between. You need, from your
[Meta App dashboard](https://developers.facebook.com) (WhatsApp → API
Setup):

- a **permanent access token** (a System User token with
  `whatsapp_business_messaging` permission),
- the **Phone number ID** (a numeric ID, *not* the phone number),
- the number's human-facing E.164 form (e.g. `+62812…`) — Suppuo uses
  it as the integration's display identity,
- optionally your **WABA ID** and your **app secret** (recommended —
  see below).

Connect in [/dashboard/channels](/dashboard/channels) → WhatsApp
Cloud API → **Connect Meta direct**, or via the API:

```bash
curl -X POST https://suppuo.com/api/v1/channels \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "whatsapp_cloud",
    "accessToken": "EAAGxxxxxxxxxxxxxxxx",
    "phoneNumberId": "1234567890",
    "displayNumber": "+62812xxxxxxx",
    "appSecret": "your-meta-app-secret"
  }'
```

The token is validated live (Suppuo reads the phone number's own
record on the Graph API); a rejected token never activates. The
response hands you everything for the **one manual step** — telling
Meta where to deliver messages:

```json
{
  "webhookUrl": "https://suppuo.com/api/v1/webhooks/whatsapp-cloud",
  "verifyToken": "wsv_xxxxxxxxxxxxxxxx",
  "note": "Meta App dashboard → WhatsApp → Configuration → Webhook: set the Callback URL + Verify token above, then subscribe to the \"messages\" field."
}
```

In the Meta App dashboard:

1. **WhatsApp → Configuration → Webhook → Edit.**
2. Paste the **Callback URL** and **Verify token** from the response,
   then hit *Verify and save* — Meta calls Suppuo with the token, and
   the handshake passes only when it matches your integration.
3. Under **Webhook fields**, subscribe to **`messages`**.

The portal shows the same callback URL + verify token right after you
connect (the verify token is shown **once** — save it if you'll
re-run the Meta handshake later, or pass your own `verifyToken` in
the connect payload).

About `appSecret` — honestly: Meta signs webhook deliveries with your
app secret (`X-Hub-Signature-256`). When you store it at connect time,
Suppuo verifies the signature on every inbound delivery and drops
mismatches. When you don't, Suppuo relies on the unguessable
verify-token handshake plus phone-number-ID routing. Providing the
app secret is the stricter setup; do it if you can.

Inbound messages route by `phone_number_id` to your workspace;
delivery/read receipts are ignored. Agent replies go out to
`graph.facebook.com` with your token.

### Email via your own Resend

Connect your own [Resend](https://resend.com) API key and a from
address on a domain you've verified with Resend. Requester
notifications for your workspace then send from *your* address
instead of the platform default:

```bash
curl -X POST https://suppuo.com/api/v1/channels \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "email_resend",
    "apiKey": "re_xxxxxxxxxxxx",
    "fromEmail": "support@yourstore.com",
    "fromName": "Toko Anda"
  }'
```

### Telegram bot

Messages to your own Telegram bot become tickets; agent replies go
back to the same chat. Setup is the easiest of the bunch — **no
manual webhook step at all**:

1. In Telegram, talk to [@BotFather](https://t.me/BotFather) →
   `/newbot` → pick a name and a username. BotFather hands you a bot
   token that looks like `123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
2. Paste the token in [/dashboard/channels](/dashboard/channels) →
   Telegram bot → **Connect your bot**, or via the API:

```bash
curl -X POST https://suppuo.com/api/v1/channels \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "telegram_bot",
    "botToken": "123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }'
```

Suppuo validates the token live (asking Telegram who the bot is — the
bot's `@username` becomes the integration's display name) and then
**registers the inbound webhook with Telegram automatically** via
`setWebhook`. From that moment, anyone who messages your bot opens a
ticket with `channel: "telegram"`; your agents' public replies are
delivered back into the Telegram chat.

Threading mirrors WhatsApp: the requester is identified by their
Telegram chat, the latest non-`closed` ticket for that chat gets
follow-ups appended (re-opening it), and a `closed` ticket means the
next message starts fresh. Telegram tickets usually have **no email
address** — the conversation lives entirely in Telegram.

If `setWebhook` fails (rare — a Telegram hiccup), the integration is
marked `error` with a `400`; just connect again.

### Slack notifications

Outbound-only **team** notifications — not a customer channel. Your
team gets a Slack message when a **new ticket** arrives on any channel
and when a **customer replies**. (Agent replies and internal notes
don't notify — your team wrote them.)

1. In Slack, create an **incoming webhook** for the channel you want
   (Slack App directory → "Incoming WebHooks", or a Slack app with an
   incoming webhook). The URL looks like
   `https://hooks.slack.com/services/TXXXXXXXX/BXXXXXXXX/xxxxxxxxxxxx`.
2. Paste it in [/dashboard/channels](/dashboard/channels) → Slack
   notifications → **Connect Slack**, or via the API:

```bash
curl -X POST https://suppuo.com/api/v1/channels \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "slack_webhook",
    "webhookUrl": "https://hooks.slack.com/services/TXXXXXXXX/BXXXXXXXX/xxxxxxxxxxxx"
  }'
```

The live validation **is** a test message — "Suppuo connected ✓"
appears in the channel immediately, so you know the wiring works
before the first real ticket. Each notification links straight to the
ticket in your inbox.

### Discord notifications

The same team notifications, into Discord:

1. In Discord: **Server Settings → Integrations → Webhooks → New
   Webhook**, pick the channel, copy the URL
   (`https://discord.com/api/webhooks/123456789012345678/xxxxxxxxxxxx`).
2. Connect it:

```bash
curl -X POST https://suppuo.com/api/v1/channels \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "discord_webhook",
    "webhookUrl": "https://discord.com/api/webhooks/123456789012345678/xxxxxxxxxxxx"
  }'
```

Same behavior as Slack: a "connected ✓" test message on connect, then
an embed per new ticket and per customer reply, linking to the ticket.

You can connect Slack *and* Discord (or several of each) — every
active webhook gets every notification. Delivery is fire-and-forget
with a 5-second timeout; a Slack outage never blocks a ticket.

## How inbound routing works

Every inbound channel is multi-tenant — Suppuo decides which workspace
owns a message by an identifier that belongs to exactly one workspace:

| Channel | Routed by |
|---|---|
| WhatsApp (Twilio) | the **receiving number** (the number you connected) |
| WhatsApp (Cloud API) | the **`phone_number_id`** in Meta's delivery |
| Telegram | a **per-integration webhook URL** registered with your bot |
| Email-to-ticket | the **alias** `<accountId>@in.suppuo.com` |
| Form / widget | the **`accountId`** in the form URL / embed snippet |

Replies go back out through the same workspace's own credentials. One
number (or bot, or alias) belongs to exactly one workspace.

When a workspace has **both** a Twilio and a Cloud API WhatsApp
integration, outbound replies use the most recently connected one.

## Managing integrations

- `GET /api/v1/channels` — list your workspace's integrations
  (credentials are **never** included) plus which platform channels
  are live.
- `POST /api/v1/channels` — connect (or refresh) an integration, as
  above. Reconnecting the same number/address/bot updates credentials
  in place.
- `DELETE /api/v1/channels/:id` — disconnect. Also available from the
  portal. After disconnecting an inbound integration, messages to that
  number/bot no longer reach your inbox.

## See also

- [WhatsApp (beta)](/docs/whatsapp) — how WA messages thread into
  tickets.
- [Live chat widget](/docs/live-chat-widget) — the embeddable chat
  bubble.
- [Email-to-ticket](/docs/email-to-ticket) — the inbound email alias.
- [Email notifications](/docs/email-notifications) — what requesters
  receive.
- [API keys](/docs/api-keys) — the `sk_live_xxx` tokens used in the
  examples above.

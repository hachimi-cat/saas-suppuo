---
title: "Email notifications"
---

# Email notifications

Pelanggan selalu tahu kabar tiketnya tanpa harus login — Suppuo
mengirim email otomatis di momen yang penting. Suppuo emails the
**requester** (your customer) at the moments that matter, and every
email carries their private status link so they can read the thread and
reply without an account. They can also just hit *Reply* — see
[replying threads back in](#replying-threads-back-in) below.

## What gets sent

### Ticket received

Sent when a ticket is created with a requester email — whether the
customer submitted your [hosted form](/docs/public-form) or an agent
[logged the inquiry](/docs/tickets#create-a-ticket) via the API or
portal.

- **Subject:** `[#42] We received your request — <ticket subject>`
- **Body:** confirmation with the ticket number and the status link.

### Agent replied

Sent when an agent posts a **public** reply on a ticket that has a
requester email.

- **Subject:** `[#42] New reply — <ticket subject>`
- **Body:** the reply text (with the agent's name when provided) and
  the status link to continue the conversation.

### How did we do? (CSAT survey)

Sent **once** when the ticket is set to `resolved` — three one-click
emoji links (😞 😐 😊) onto the tokenized rating page. Skipped when
the requester already rated from the status page. Details in
[Automation & CSAT](/docs/automation-csat#csat-surveys).

### Auto-reply (optional)

When your workspace has the
[auto-response](/docs/automation-csat#auto-response) enabled, a new
email/form/widget ticket also gets the automatic acknowledgement,
delivered like an agent reply.

All these emails link to the requester's private status page:

```
https://suppuo.com/t/<token>
```

## What never gets sent

- **Internal notes.** Agent-only, by design — they're never emailed,
  never shown on the status page, never delivered to WhatsApp.
- **Status-change notifications.** Setting a ticket to `resolved` or
  `closed` doesn't email anyone; only actual replies do.
- **Emails to tickets without an email address.** WhatsApp and
  Telegram tickets identified only by phone or chat id
  (`requesterEmail: null`) skip email entirely — see
  [WhatsApp](/docs/whatsapp).

Notifications are fire-and-forget: a mail delivery hiccup never blocks
the ticket or the reply itself.

## Replying threads back in

Every notification email sets **`Reply-To`** to your workspace's
inbound address (`<accountId>@in.suppuo.com`). A customer who simply
hits *Reply* in their mail app lands back on the same ticket — no
status link required. The status link remains the richer option
(full thread, attachments, the rating block), but plain email replies
just work. How the inbound side operates — including forwarding your
own `support@` — is covered in
[Email-to-ticket](/docs/email-to-ticket).

## Sender address

By default, notifications come from
`Suppuo <noreply@suppuo.forjio.com>`. Ask your customers to whitelist
it if their inbox is aggressive about new senders. Want them from
**your own domain**? Connect your own Resend account —
[Channels → Email via your own Resend](/docs/channels#email-via-your-own-resend).
(Self-hosted/dev deployments: sending is env-gated — without a mail
key configured the backend logs the email instead of sending, so
nothing breaks in development.)

## See also

- [Email-to-ticket](/docs/email-to-ticket) — the inbound half of the
  email channel.
- [Automation & CSAT](/docs/automation-csat) — the survey and
  auto-reply emails.
- [Hosted support form](/docs/public-form) — where the status link
  leads.
- [WhatsApp](/docs/whatsapp) — the channel for customers who
  don't do email.

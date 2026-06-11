---
title: "Email notifications"
---

# Email notifications

Pelanggan selalu tahu kabar tiketnya tanpa harus login — Suppuo
mengirim email otomatis di momen yang penting. Suppuo emails the
**requester** (your customer) at the two moments that matter, and every
email carries their private status link so they can read the thread and
reply without an account.

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

Both emails link to the requester's private status page:

```
https://suppuo.com/t/<token>
```

## What never gets sent

- **Internal notes.** Agent-only, by design — they're never emailed,
  never shown on the status page, never delivered to WhatsApp.
- **Status-change notifications.** Setting a ticket to `resolved` or
  `closed` doesn't email anyone; only actual replies do.
- **Emails to tickets without an email address.** WhatsApp-channel
  tickets identified only by phone (`requesterEmail: null`) skip email
  entirely — see [WhatsApp](/docs/whatsapp).

Notifications are fire-and-forget: a mail delivery hiccup never blocks
the ticket or the reply itself.

## Outbound only — no email-to-ticket (yet)

Today the email channel is **one-way, outbound**. Customers can't open
or answer tickets by emailing you; replying to a notification email
won't land in the thread — the emails point customers at the status
link instead, and that's where replies happen.

Inbound email-to-ticket (a support@ address that creates and threads
tickets) is on the roadmap. Until then, the
[hosted form](/docs/public-form) plus the status link covers the same
ground: a no-login way in, and a no-login way to keep talking.

## Sender address

Notifications come from `Suppuo <noreply@suppuo.forjio.com>`. Ask your
customers to whitelist it if their inbox is aggressive about new
senders. (Self-hosted/dev deployments: sending is env-gated — without
a mail key configured the backend logs the email instead of sending,
so nothing breaks in development.)

## See also

- [Hosted support form](/docs/public-form) — where the status link
  leads.
- [WhatsApp (beta)](/docs/whatsapp) — the channel for customers who
  don't do email.

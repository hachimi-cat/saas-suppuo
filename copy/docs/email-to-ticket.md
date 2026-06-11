---
title: "Email-to-ticket"
---

# Email-to-ticket

Email ke `support@toko-anda.com` bisa langsung jadi tiket — tanpa
copy-paste. Email-to-ticket is the **inbound** half of the email
channel: every workspace owns a dedicated address, every email to it
becomes a ticket, and the customer's plain email replies thread
straight back into the conversation.

## Your inbound address

Every workspace gets one, automatically — no setup, nothing to enable:

```
<accountId>@in.suppuo.com
```

Find your exact address (with your `acc_…` workspace ID filled in) at
[/dashboard/channels](/dashboard/channels) under **Email-to-ticket
(inbound)**.

## Recommended setup: forward your support@

You *can* hand the `acc_…@in.suppuo.com` address out directly, but a
branded address looks better. Keep `support@yourstore.com` public and
**forward** it to your Suppuo alias:

- **Google Workspace / Gmail** — Settings → Forwarding (or a routing
  rule in the Workspace admin console) → forward to
  `acc_xxxxxxxxxxxxxxxxxxxxxxxx@in.suppuo.com`.
- **cPanel / your hosting panel** — add an email **forwarder** from
  `support@` to the alias.
- **Zoho, Outlook, etc.** — any "forward incoming mail to" rule works.

Customers keep emailing the address they know; tickets appear in your
inbox.

## How an email becomes a ticket

When mail arrives at your alias:

- the **subject** becomes the ticket subject (`"Email inquiry"` when
  empty),
- the **From** address and name become `requesterEmail` /
  `requesterName`,
- the ticket gets `channel: "email"`,
- the body is stored as the first message. Trailing quoted chains
  ("On … wrote:" blocks and `>`-quoted tails) are trimmed
  conservatively, so forwarded threads don't bloat the ticket.

**Threading** mirrors every other channel: if the workspace already
has a non-`closed` ticket for that requester email, the new email is
**appended** to it as a requester reply (re-opening a `resolved`
ticket per the normal rules). Otherwise a fresh ticket is created.
Only `closed` ends a thread — the next email then opens a new ticket.

## Replies thread both ways

This is the part that makes email a real two-way channel:

- **You → customer**: your agents reply from the inbox as usual; the
  customer gets the standard
  [notification email](/docs/email-notifications).
- **Customer → you**: every notification email Suppuo sends sets
  **`Reply-To`** to your workspace's inbound alias. The customer just
  hits *Reply* in their mail app — no status link needed — and the
  reply lands back on the same ticket.

## Plumbing, honestly

For the curious (and the security-conscious):

- MX for `in.suppuo.com` is handled by Resend; deliveries reach Suppuo
  over a **signature-verified webhook** (HMAC, 5-minute replay
  window) and are processed **idempotently** — a redelivered email
  never duplicates a ticket.
- The alias itself is the gate: workspace IDs (`acc_` + 24 hex chars)
  are unguessable in practice, and mail to a malformed or unknown
  alias is dropped. `+tag` suffixes on the alias are tolerated
  (`acc_xxx+shop@in.suppuo.com` works).
- **Inbound email attachments aren't stored yet** — only the text
  body (or the HTML converted to text) makes it onto the ticket.
  Customers who need to send files can use their status link or the
  [widget](/docs/live-chat-widget), where
  [attachments](/docs/attachments) work.

## See also

- [Email notifications](/docs/email-notifications) — the outbound
  half.
- [Channels](/docs/channels) — connect your own Resend to send from
  your own domain.
- [Tickets API](/docs/tickets) — what the resulting tickets look
  like.

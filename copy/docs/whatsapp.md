---
title: "WhatsApp (beta)"
---

# WhatsApp channel (beta)

Pelanggan Indonesia hidup di WhatsApp — dengan channel ini, chat WA
masuk ke inbox Suppuo sebagai tiket, dan balasan agen terkirim balik ke
WA pelanggan. With the WhatsApp channel, customers chat on the number
they already know, and your team answers from the same Suppuo inbox as
everything else.

> **Beta.** Setup is operator-managed: there's no self-serve WhatsApp
> configuration in the dashboard yet. If you want WhatsApp on your
> workspace, contact us at support@forjio.com and we'll connect a
> number for you. One WhatsApp number per workspace in the beta.

## How inbound messages become tickets

When a customer messages your connected WhatsApp number:

- **They already have an open conversation** — i.e. your workspace has
  a non-`closed` ticket for that phone number — the message is appended
  to that ticket as a requester reply. Like any requester reply, this
  moves the ticket (back) to `open`, so a `resolved` ticket the
  customer follows up on resurfaces in your inbox.
- **No open conversation** — a new ticket is created with:
  - `channel: "whatsapp"`,
  - the subject taken from the first line of the message (truncated to
    120 characters; "WhatsApp inquiry" if empty),
  - `requesterPhone` set to the customer's number (E.164, e.g.
    `+62812…`),
  - `requesterName` from their WhatsApp profile name, when available.

Only a `closed` ticket ends the threading: closing a ticket means the
customer's *next* WhatsApp message opens a fresh one. Setting it to
`resolved` keeps the thread — a follow-up re-opens the same ticket.

## Phone-identified tickets

WhatsApp tickets are identified by phone number, not email — so
`requesterEmail` **may be `null`** on these tickets. That has two
consequences:

- No [email notifications](/docs/email-notifications) are sent for
  them (there's no address to send to). The conversation lives entirely
  on WhatsApp.
- If you later learn the customer's email, you can log future
  inquiries via [POST /api/v1/tickets](/docs/tickets#create-a-ticket)
  with `channel: "whatsapp"` and a `requesterEmail` — that ticket gets
  both the email status link *and* WhatsApp delivery of replies.

## Agent replies

Reply from the ticket view (or via
[POST /api/v1/tickets/:id/messages](/docs/tickets#reply-to-a-ticket))
exactly as you would on any ticket:

- A **public** reply on a `whatsapp`-channel ticket with a
  `requesterPhone` is delivered to the customer over WhatsApp, from
  your workspace's connected number.
- **Internal notes** are never sent to WhatsApp (nor anywhere else) —
  they stay agent-only, as always.
- Status transitions are the standard ones: your public reply moves
  the ticket to `pending`; the customer's next WhatsApp message moves
  it back to `open`.

A WhatsApp delivery failure never blocks the reply itself — the
message is saved on the ticket regardless.

## Beta limitations, honestly

- **Operator-managed setup** — no self-serve number connection or
  webhook configuration in the dashboard yet.
- **One number per workspace**, and one workspace per number.
- Inbound handling is **text-first**: the message body becomes the
  ticket message. Media attachments aren't stored yet.
- No WhatsApp message templates / outbound-first messaging — the
  channel is for replying within conversations customers start.

Self-serve, multi-number setup is on the roadmap as the channel
graduates from beta.

## See also

- [Tickets API](/docs/tickets) — statuses, replies, the ticket object
  (including `requesterPhone`).
- [Getting started](/docs/getting-started) — the inbox basics.

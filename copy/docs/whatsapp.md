---
title: "WhatsApp (beta)"
---

# WhatsApp channel (beta)

Pelanggan Indonesia hidup di WhatsApp — dengan channel ini, chat WA
masuk ke inbox Suppuo sebagai tiket, dan balasan agen terkirim balik ke
WA pelanggan. With the WhatsApp channel, customers chat on the number
they already know, and your team answers from the same Suppuo inbox as
everything else.

> **Beta.** Three ways to get a number on your workspace:
>
> - **Bring your own Twilio (self-serve, live today)** — connect your
>   own Twilio account + WhatsApp number at
>   [/dashboard/channels](/dashboard/channels) in a couple of minutes.
>   Unlimited messages — you pay Twilio directly, Suppuo doesn't meter
>   them. Setup steps in
>   [Channels](/docs/channels#whatsapp-via-your-own-twilio).
> - **Bring your own Meta WhatsApp Business (self-serve, live today)**
>   — connect Meta's Cloud API directly, no Twilio in between. Setup
>   steps in
>   [Channels](/docs/channels#whatsapp-cloud-api-meta-direct).
> - **Suppuo platform number (pending)** — a shared, metered Suppuo
>   number is awaiting WhatsApp approval and isn't live yet.
>
> One WhatsApp number per workspace in the beta (if you connect both
> a Twilio and a Cloud API number, replies go out via the most
> recently connected one).

## Which workspace gets the message?

Routing is multi-tenant by the **receiving number**: a customer's
message to your connected number lands in *your* workspace's inbox
(Twilio numbers are matched on the number itself; Cloud API numbers
on Meta's `phone_number_id`), and your agents' replies go back out
from that same number — through your own Twilio account or your own
Meta access token. One number belongs to exactly one workspace.

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

## Media attachments

On a **Twilio**-connected number, inbound media — photos, voice
notes, videos, documents — is stored as
[attachments](/docs/attachments) on the inbound message. A customer
who sends only a photo still produces a readable message
(`[attachment: photo-1.jpg]`) with the file attached, viewable and
downloadable from the ticket.

On a **Cloud API** (Meta direct) number, inbound handling is
text-only for now — media isn't stored yet. Outbound agent
attachments aren't pushed over WhatsApp on either provider; customers
view them on their status page.

## Beta limitations, honestly

- **The shared platform number isn't live yet** — today the channel
  requires bringing your own number, via Twilio or Meta's Cloud API
  (both self-serve at [/dashboard/channels](/dashboard/channels)).
  One provider-console step is manual either way: pointing the
  incoming-message webhook at the URL Suppuo gives you — see
  [Channels](/docs/channels#bring-your-own-provider-byo).
- **One number per workspace**, and one workspace per number.
- Cloud API inbound is **text-first** (no media yet); Twilio inbound
  media is stored.
- No WhatsApp message templates / outbound-first messaging — the
  channel is for replying within conversations customers start.

Multi-number workspaces are on the roadmap as the channel graduates
from beta.

## See also

- [Channels](/docs/channels) — connect your own Twilio or Meta
  account, step by step.
- [Tickets API](/docs/tickets) — statuses, replies, the ticket object
  (including `requesterPhone`).
- [Automation & CSAT](/docs/automation-csat) — auto-replies are
  delivered over WhatsApp too.
- [Getting started](/docs/getting-started) — the inbox basics.

---
title: "Getting started"
---

# Getting started

Dari daftar sampai tiket pertama selesai dibalas — kira-kira lima menit.
This guide walks you from sign-up to your first resolved ticket.

## 1. Create your workspace

Suppuo signs you in with **Huudis**, the shared Forjio account — one
login works across every Forjio product.

1. Go to [/signup](/signup) (or [/login](/login) if you already have a
   Huudis account from another Forjio product).
2. Sign in with email + password or "Continue with Google".
3. You land in the dashboard with a fresh **workspace** — that
   workspace is your team's helpdesk. Invite teammates from the
   workspace settings; every member can work the inbox as an agent.

## 2. The inbox

Your inbox lives at [/dashboard/tickets](/dashboard/tickets). Every
customer inquiry is a **ticket** with:

- a per-workspace number (`#1`, `#2`, …),
- a **status** — `open` (needs an agent), `pending` (waiting on the
  customer), `resolved`, or `closed`,
- a **priority** — `low`, `normal`, `high`, or `urgent`,
- a **channel** — `web` (your hosted form), `whatsapp`, or `email`
  (logged by an agent),
- the conversation thread: customer messages, agent replies, and
  agent-only internal notes.

The status moves itself as the conversation flows — a customer reply
puts the ticket back in `open`, an agent reply moves it to `pending`.
The exact rules are in the [Tickets API](/docs/tickets#ticket-statuses)
page.

## 3. Share your support form

Suppuo hosts a public support form for your workspace — no code, no
embed script.

1. Open **Settings** in the dashboard.
2. Copy the **support form URL** under "Your support form". It looks
   like:

   ```
   https://suppuo.com/support/<your-account-id>
   ```

3. Put it anywhere customers can see it: Instagram bio, website footer,
   marketplace store description, or your WhatsApp Business auto-reply.

Anything submitted there becomes a ticket in your inbox, and the
customer immediately gets an email with a private status link. Details
in [Hosted support form](/docs/public-form).

## 4. Your first ticket, end to end

Try it yourself with two browser tabs:

1. **Submit** — open your form URL in a private window, fill in a
   subject, message, and your own email, and submit. The confirmation
   screen shows the ticket number and a status link (`/t/<token>`); the
   same link arrives by email.
2. **Reply** — back in the dashboard, the ticket appears in the inbox
   as `open`. Open it, type a reply, and send. The ticket flips to
   `pending` and the customer gets a "New reply" email with your
   message and the status link. (Tip: tick **internal note** instead to
   leave a comment only your team can see — internal notes never reach
   the customer and don't change the status.)
3. **Customer replies** — open the status link from the email, reply
   as the customer. The ticket goes back to `open` in your inbox: the
   ball is in your court again.
4. **Resolve** — when it's done, set the status to `resolved` from the
   ticket's status control.

That loop — form in, reply out, status moving itself — is all of
Suppuo's core. Everything else builds on it.

## What's next

- [Canned replies](/docs/canned-replies) — save your common answers
  and insert them with one click.
- [WhatsApp (beta)](/docs/whatsapp) — receive and answer WhatsApp
  messages from the same inbox.
- [API authentication](/docs/api-auth) + the
  [Tickets API](/docs/tickets) — automate ticket logging and replies.

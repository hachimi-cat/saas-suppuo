---
title: "Automation & CSAT"
---

# Automation & CSAT

Balas otomatis saat tim sedang tutup, dan tanya "puas nggak?" setelah
tiket selesai — dua hal kecil yang membuat toko terlihat profesional.
This page covers the two workspace automations: the **auto-response**
(a business-hours-aware acknowledgement on every new ticket) and
**CSAT surveys** (a one-click satisfaction rating after a ticket is
resolved).

Both are configured at
[/dashboard/settings](/dashboard/settings).

## Auto-response

When enabled, every **new ticket** immediately gets an automatic
reply — so a customer who writes at 11 pm knows their message landed,
and one who writes at 11 am knows you're on it.

Two templates, picked by the clock:

- **Inside business hours** — e.g. *"Terima kasih! Tim kami akan
  membalas dalam 1–2 jam."*
- **Outside business hours** — e.g. *"Kami sedang tutup — kami balas
  besok mulai jam 09:00 WIB."*

The auto-reply:

- is sent over the **ticket's origin channel** — by email for form /
  widget / email tickets, over WhatsApp for WhatsApp tickets, into the
  chat for Telegram tickets,
- appears in the ticket thread as a real message authored by
  **"Auto-reply"**, visible to both the customer and your agents,
- fires **once per ticket**, on creation only — follow-up replies
  don't re-trigger it,
- stays **silent** when the matching template is empty (e.g. fill in
  only the outside-hours template to auto-reply only at night).

### Business hours

Hours are per-day windows in your timezone (WIB —
`Asia/Jakarta` — is the default the portal offers):

- each weekday is either **closed** or has an `open`–`close` window
  in `HH:mm` (24-hour),
- **overnight windows work**: `22:00`–`06:00` means open from 10 pm
  through 6 am the next morning,
- no business hours configured = every ticket gets the
  **inside**-hours template.

### Settings API

The portal is a thin layer over `GET`/`PUT
/api/v1/settings/automation`:

```bash
curl -X PUT https://suppuo.com/api/v1/settings/automation \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "autoResponseEnabled": true,
    "autoResponseInside": "Terima kasih! Tim kami akan membalas dalam 1-2 jam.",
    "autoResponseOutside": "Kami sedang tutup. Kami balas besok mulai 09:00 WIB.",
    "businessHours": {
      "tz": "Asia/Jakarta",
      "days": [
        null,
        { "dow": 1, "open": "09:00", "close": "17:00" },
        { "dow": 2, "open": "09:00", "close": "17:00" },
        { "dow": 3, "open": "09:00", "close": "17:00" },
        { "dow": 4, "open": "09:00", "close": "17:00" },
        { "dow": 5, "open": "09:00", "close": "17:00" },
        null
      ]
    }
  }'
```

- `businessHours.days` is exactly 7 entries indexed by day-of-week
  (`0` = Sunday … `6` = Saturday); `null` = closed that day.
- Templates max 5 000 chars; `null` (or empty) clears a template.
- `businessHours: null` clears the schedule entirely.
- Fields you omit are left unchanged. `GET` returns the same shape
  (defaults: everything off / `null`).
- `hideBranding: true` removes "Powered by Suppuo" from requester
  emails, the live chat widget, and your hosted form + ticket status
  pages (a paid-tier perk — free for everyone during early access).
  Also togglable in the portal under **Settings → Branding**.

## CSAT surveys

When a ticket is set to **`resolved`**, the requester gets one survey
email — three one-click emoji links:

> **How did we do?** 😞 😐 😊

One click records the rating (1 = 😞, 2 = 😐, 3 = 😊) on the
tokenized rating page (`/t/<token>/rate`), where they can also leave
an optional comment. The same "How did we do?" block appears on the
ticket's status page once it's resolved.

Send rules, honestly:

- **At most one survey email per ticket** — re-resolving a re-opened
  ticket doesn't send another.
- No email goes out if the requester **already rated** (e.g. via the
  status page) or if the ticket has **no email address**
  (phone-/chat-identified WhatsApp and Telegram tickets) — those
  customers can still rate from the status page if they have the
  link.
- The requester **can change their rating** — the latest score wins.
- Ratings only open once the ticket is `resolved` or `closed`;
  earlier attempts get a `409`.

### CSAT endpoints

Submit (public, tokenized — this is what the email links and the
status page call):

```bash
curl -X POST "https://suppuo.com/api/v1/public/tickets/TICKET_ACCESS_TOKEN/csat" \
  -H "Content-Type: application/json" \
  -d '{ "score": 3, "comment": "Cepat dan ramah!" }'
```

| Field | Type | Notes |
|---|---|---|
| `score` | int | required — `1` (bad), `2` (okay), `3` (great) |
| `comment` | string | optional, ≤2 000 chars |

Read your workspace's aggregates (agent surface — powers the
dashboard's satisfaction card):

```bash
curl -H "Authorization: Bearer sk_live_xxx" \
  "https://suppuo.com/api/v1/csat/stats"
```

```json
{
  "data": { "average": 2.71, "count": 34 },
  "error": null,
  "meta": { "requestId": "req_01jx…", "timestamp": "2026-06-11T03:25:00.000Z" }
}
```

`average` is on the 1–3 scale (`null` until the first rating). The
public ticket view (`GET /api/v1/public/tickets/:accessToken`) also
carries the ticket's own `csat` (`{ score, comment }` or `null`).

## See also

- [Email notifications](/docs/email-notifications) — the emails these
  features ride on.
- [Tickets API](/docs/tickets#ticket-statuses) — what `resolved`
  means and how statuses move.
- [Hosted support form](/docs/public-form) — the tokenized public
  surface the rating page belongs to.

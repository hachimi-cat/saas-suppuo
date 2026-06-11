---
title: "Live chat widget"
---

# Live chat widget

One line of script, and your website has live chat wired straight
into your Suppuo inbox. The widget is a chat bubble for **your own
website**: visitors leave a message without leaving the page, it
becomes a ticket in your inbox, and your replies show up right in the
widget (and by email).

## Install — one script tag

Paste this just before `</body>` on any page:

```html
<script src="https://suppuo.com/widget.js"
        data-suppuo-account="acc_xxxxxxxxxxxxxxxxxxxxxxxx" async></script>
```

Your exact snippet — with your workspace's real `acc_…` ID filled in
and a copy button — is in
[/dashboard/channels](/dashboard/channels) under **Live chat widget**,
along with a live preview link. That's the whole install: no npm
package, no framework requirement, no CSS to include. The widget is
plain self-contained JavaScript that injects its own styles.

### Attributes

| Attribute | Required | Notes |
|---|---|---|
| `data-suppuo-account` | yes | your workspace's `acc_…` ID — without it the widget logs a warning and renders nothing |
| `data-position` | no | `"left"` puts the bubble bottom-left; default is bottom-right |
| `data-suppuo-base` | no | API/brand origin override (default: the origin the script was loaded from) — useful for staging |

```html
<script src="https://suppuo.com/widget.js"
        data-suppuo-account="acc_xxxxxxxxxxxxxxxxxxxxxxxx"
        data-position="left" async></script>
```

## What the visitor sees

1. A chat bubble (bottom corner). Clicking it opens a small panel.
2. First visit: a short form — email (required), message, optional
   name. Submitting it **creates a ticket** in your inbox
   (`channel: "web"`, subject taken from the first line of the
   message) and the visitor drops straight into the conversation view.
3. From then on the panel shows the live thread: their messages, your
   agents' public replies, the ticket number and status in the header.
   While the panel is open it refreshes every 10 seconds.
4. They can attach files with the paperclip — same rules as everywhere
   else (8MB per file, up to 5 per message, images/pdf/docs — see
   [Attachments](/docs/attachments)).
5. They also get the standard
   [ticket-received email](/docs/email-notifications) with their
   private status link, so the conversation survives a closed browser
   tab — they can continue in the widget, on the status page, or by
   replying to the email.

The conversation is remembered per browser via `localStorage` (key
`suppuo_widget_<accountId>` holding the ticket's access token), so a
returning visitor reopens the same thread. "Start a new conversation"
at the bottom of the panel resets it.

## What your team sees

Nothing new to learn: a widget conversation is a normal ticket. It
arrives as `open` with `channel: "web"`, threads like any other
ticket, triggers [Slack/Discord notifications](/docs/channels#slack-notifications)
and [auto-responses](/docs/automation-csat) like any other ticket, and
your reply from the inbox is what appears in the visitor's widget.

## How it works under the hood

The widget rides entirely on the
[public ticket API](/docs/public-form#the-public-api) — the same three
endpoints the hosted form uses, called cross-origin (the `/api/v1/public`
surface sends permissive CORS headers; the access token is a
capability URL, not a cookie, so this is safe). If you want a fully
custom chat UI instead, build against those endpoints directly and
skip the widget.

## Honestly, the limits

- **Polling, not websockets** — replies appear within ~10 seconds
  while the panel is open, not instantly.
- **One conversation per browser** at a time (per workspace); "Start
  a new conversation" abandons the old thread from the widget's point
  of view (the ticket itself stays in your inbox, and the email status
  link still works).
- In private/incognito mode the conversation lasts only as long as
  the tab (no `localStorage`).

## See also

- [Hosted support form](/docs/public-form) — the no-code page version
  of the same public surface.
- [Attachments](/docs/attachments) — file rules shared by the widget.
- [Channels](/docs/channels) — everything else that feeds the inbox.

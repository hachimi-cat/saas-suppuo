# forjio-suppuo

Typed Python client for the [suppuo.com](https://suppuo.com) helpdesk REST API.

```bash
pip install forjio-suppuo
```

```python
from forjio_suppuo import SuppuoClient

# Bearer token from token= or the SUPPUO_TOKEN env var — use an
# sk_live_... API key from Dashboard -> Settings -> API keys.
client = SuppuoClient(token="sk_live_xxx")

# Tickets — agent workspace surface
page = client.tickets.list(status="open", channel="telegram", tag="billing", q="refund")
ticket = client.tickets.get(page["tickets"][0]["id"])
client.tickets.reply(ticket["id"], body="On it!", is_internal=False)
client.tickets.update(ticket["id"], status="resolved", tags=["billing", "vip"])
tags = client.tickets.tags()  # distinct tags (autocomplete feed)

# Attachments — stage, bind to a reply, download
with open("invoice.pdf", "rb") as f:
    meta = client.attachments.upload(
        data=f.read(), filename="invoice.pdf", content_type="application/pdf"
    )
client.tickets.reply(ticket["id"], body="Attached.", attachment_ids=[meta["id"]])
file = client.attachments.download(meta["id"])  # {"data", "contentType", "filename"}

# Billing — current plan + upgrade checkout (tiers: free / starter / growth / business)
info = client.billing.get()
out = client.billing.checkout("growth")  # redirect the browser to out["hostedUrl"]

# Channels — BYO integrations
channels = client.channels.list()
client.channels.create(provider="telegram_bot", botToken="123456789:AAxxx")
client.channels.delete(channels["integrations"][0]["id"])

# Reports / settings / CSAT
summary = client.reports.summary(days=30)
automation = client.settings.get_automation()
client.settings.put_automation(auto_response_enabled=True, hide_branding=True)
csat = client.csat.stats()

# Canned replies
client.canned_replies.create(title="Refund policy", body="...")

# Public (requester) surface — no token required
out = client.public.submit_ticket(
    account_id="acc_...",
    subject="Order question",
    body="Where is my order?",
    email="customer@example.com",
)
view = client.public.get_ticket(out["accessToken"])
client.public.reply_ticket(out["accessToken"], body="Any update?")
```

## Endpoints covered

| Namespace | Methods |
| --- | --- |
| `tickets` | `list` (status / assignee / tag / channel / priority / q / limit / cursor), `tags`, `get`, `create`, `reply` (with `attachment_ids`), `update` (status / priority / assignee_sub / tags) |
| `billing` | `get` (subscription + tier table), `checkout(tier)` -> hosted checkout URL |
| `channels` | `list`, `create` (whatsapp_twilio / whatsapp_cloud / email_resend / telegram_bot / slack_webhook / discord_webhook), `delete` |
| `reports` | `summary(days=7\|30\|90)` |
| `settings` | `get_automation`, `put_automation` (business hours, auto-response, hide_branding) |
| `csat` | `stats` |
| `attachments` | `upload` (raw bytes + filename, 8MB max), `download` |
| `canned_replies` | `list`, `create`, `update`, `delete` |
| `public` | `submit_ticket`, `get_ticket`, `reply_ticket` (no token) |

Errors raise `SuppuoError` carrying the API envelope's `error.code`
(`NOT_FOUND`, `VALIDATION_ERROR`, `AUTH_REQUIRED`, ...), the HTTP
status, and the `meta.requestId`.

## Family

Sister to:
- [`@forjio/suppuo`](https://www.npmjs.com/package/@forjio/suppuo) (JS/TS)
- [`hachimi-cat/suppuo-go`](https://github.com/hachimi-cat/suppuo-go) (Go)

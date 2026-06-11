# forjio-suppuo

Typed Python client for the [suppuo.com](https://suppuo.com) helpdesk REST API.

```bash
pip install forjio-suppuo
```

```python
from forjio_suppuo import SuppuoClient

# Bearer token from token= or the SUPPUO_TOKEN env var.
client = SuppuoClient(token="...")

# Agent workspace surface
page = client.tickets.list(status="open")
ticket = client.tickets.get(page["tickets"][0]["id"])
client.tickets.reply(ticket["id"], body="On it!", is_internal=False)
client.tickets.update(ticket["id"], status="resolved")

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

Errors raise `SuppuoError` carrying the API envelope's `error.code`
(`NOT_FOUND`, `VALIDATION_ERROR`, `AUTH_REQUIRED`, ...), the HTTP
status, and the `meta.requestId`.

## Family

Sister to:
- [`@forjio/suppuo`](https://www.npmjs.com/package/@forjio/suppuo) (JS/TS)
- [`hachimi-cat/suppuo-go`](https://github.com/hachimi-cat/suppuo-go) (Go)

---
title: "CLI & SDKs"
---

# CLI & SDKs

For those more at home in the terminal — Suppuo has an official CLI,
plus SDKs for JS, Python, and Go. The `suppuo` CLI ships as
`@forjio/suppuo-cli` on npm and follows the same conventions as every
Forjio product CLI.

## Install

Requires Node.js 20+.

```bash
npm install -g @forjio/suppuo-cli
suppuo --version
```

## Authentication

The CLI resolves its credential in this order:

1. **`SUPPUO_TOKEN`** environment variable — an
   [`sk_live_…` API key](/docs/api-keys) (recommended; create one at
   [/dashboard/api-keys](/dashboard/api-keys)) or a Huudis access
   token. Explicit and CI-friendly.
2. The session stored by `suppuo auth login` at
   `~/.suppuo/session.json`.

```bash
export SUPPUO_TOKEN=sk_live_…
suppuo tickets list
```

`SUPPUO_BASE_URL` overrides the API host (defaults to
`https://suppuo.com`).

### `suppuo auth login` / `whoami` / `logout`

Device-flow sign-in via Huudis. **Honest status:** the device flow
isn't live yet — `auth login` prints a clear "not yet wired" notice
instead of pretending to sign you in. Until it lands, use
`SUPPUO_TOKEN` with an API key — every ticket command below works
that way today.

## Ticket commands

The agent inbox from your terminal, wrapping the
[Tickets API](/docs/tickets):

### `suppuo tickets list`

```bash
suppuo tickets list                    # newest activity first
suppuo tickets list --status open      # open|pending|resolved|closed|all
suppuo tickets list --limit 10         # 1-100
```

Prints number, status (colored), priority, subject, requester, and
the ticket id, plus per-status counts.

### `suppuo tickets show <id>`

```bash
suppuo tickets show tkt_01jx…
```

The full ticket — status, priority, channel, requester, assignee —
and the whole message thread, with internal notes marked
`[internal]`.

### `suppuo tickets reply <id>`

```bash
suppuo tickets reply tkt_01jx… --message "On it — refund issued."
suppuo tickets reply tkt_01jx… --message "Note to team" --internal
suppuo tickets reply tkt_01jx… --message "Hi there!" --author-name "Adi"
```

Public by default (the requester is notified and the ticket moves to
`pending`); `--internal` posts an agent-only note instead. The
command prints the ticket's new status.

### `suppuo tickets close <id>`

```bash
suppuo tickets close tkt_01jx…
```

Sets the status to `closed` (other statuses: use the API/portal, or
reply — replies move status automatically).

Errors print the API's `error.code` and the `requestId` to quote at
support.

## SDKs

Prefer a library over raw HTTP? Suppuo ships typed clients for three
languages, all at **v0.1.0**, all covering the tickets, canned-reply,
and public (requester) surfaces, and all reading `SUPPUO_TOKEN` from
the environment by default.

### JavaScript / TypeScript — [`@forjio/suppuo`](https://www.npmjs.com/package/@forjio/suppuo)

```bash
npm install @forjio/suppuo
```

```ts
import { SuppuoClient } from "@forjio/suppuo";

const client = new SuppuoClient({ token: process.env.SUPPUO_TOKEN! });
const { tickets } = await client.tickets.list({ status: "open" });
await client.tickets.reply(tickets[0].id, { body: "On it!" });
```

### Python — [`forjio-suppuo`](https://pypi.org/project/forjio-suppuo/)

```bash
pip install forjio-suppuo
```

```python
from forjio_suppuo import SuppuoClient

client = SuppuoClient(token="sk_live_...")
page = client.tickets.list(status="open")
client.tickets.reply(page["tickets"][0]["id"], body="On it!")
```

### Go — [`github.com/hachimi-cat/suppuo-go`](https://github.com/hachimi-cat/suppuo-go)

```bash
go get github.com/hachimi-cat/suppuo-go
```

```go
c := suppuo.New(suppuo.Config{Token: os.Getenv("SUPPUO_TOKEN")})
page, err := c.Tickets.List(ctx, &suppuo.TicketListParams{Status: suppuo.StatusOpen})
_, err = c.Tickets.Reply(ctx, page.Tickets[0].ID, suppuo.TicketReplyInput{Body: "On it!"})
```

All three surface API failures with the envelope's `error.code`
(`NOT_FOUND`, `VALIDATION_ERROR`, `AUTH_REQUIRED`, …), the HTTP
status, and the `meta.requestId`.

## See also

- [API keys](/docs/api-keys) — the credential to put in
  `SUPPUO_TOKEN`.
- [API authentication](/docs/api-auth) — envelope, errors, rate
  limits.
- [Tickets API](/docs/tickets) — everything the CLI and SDKs wrap.

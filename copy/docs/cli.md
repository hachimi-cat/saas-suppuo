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

Sign in once and every command uses it:

```bash
suppuo auth login                          # your Huudis account, in the browser
suppuo auth login --api-key - < key.txt    # or an API key, for servers and CI
suppuo auth whoami
```

| Command | What it does |
|---|---|
| `suppuo auth login` | Sign in with your Huudis account: the CLI prints a code and opens the browser (Huudis device flow); approve it there. `--no-browser` only prints the link. |
| `suppuo auth login --api-key <key>` | Save an [`sk_live_…` API key](/docs/api-keys) (create one at [/dashboard/api-keys](/dashboard/api-keys)) instead — for servers and CI. Pass `-` as the key to read it from stdin, so it stays out of your shell history. |
| `suppuo auth whoami` | Show what the CLI is signed in as (the Huudis user, or which key) and the workspace Suppuo resolves it to. |
| `suppuo auth logout` | Delete the saved session or key. |

Each `auth` command takes `--json`. `auth login` saves to
`~/.suppuo/session.json` (readable only by you; a Huudis session refreshes
itself).

The CLI resolves its credential in this order:

1. **`SUPPUO_TOKEN`** environment variable — an `sk_live_…` API key or a
   Huudis access token. Explicit and CI-friendly; no `auth login` needed.
2. What `suppuo auth login` saved.

```bash
export SUPPUO_TOKEN=sk_live_…
suppuo tickets list
```

`SUPPUO_BASE_URL` overrides the API host (defaults to `https://suppuo.com`).
`--issuer <url>` (or `SUPPUO_HUUDIS_ISSUER`) and `--client-id <id>` (or
`SUPPUO_CLI_CLIENT_ID`, default `suppuo-cli`) point the sign-in at another
Huudis or OIDC client.

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

### Python — [`suppuo`](https://pypi.org/project/suppuo/)

```bash
pip install suppuo
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

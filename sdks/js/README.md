# @forjio/suppuo

Typed JS/TS client for the [suppuo.com](https://suppuo.com) helpdesk REST API.

```bash
npm install @forjio/suppuo
```

```ts
import { SuppuoClient } from "@forjio/suppuo";

// Bearer token from `token` or the SUPPUO_TOKEN env var.
const client = new SuppuoClient({ token: process.env.SUPPUO_TOKEN! });

// Agent workspace surface
const { tickets, counts } = await client.tickets.list({ status: "open" });
const ticket = await client.tickets.get(tickets[0].id);
await client.tickets.reply(ticket.id, { body: "On it!", isInternal: false });
await client.tickets.update(ticket.id, { status: "resolved" });

// Canned replies
await client.cannedReplies.create({ title: "Refund policy", body: "…" });

// Public (requester) surface — no token required
const { accessToken } = await client.public.submitTicket({
  accountId: "acc_…",
  subject: "Order question",
  body: "Where is my order?",
  email: "customer@example.com",
});
const view = await client.public.getTicket(accessToken);
await client.public.replyTicket(accessToken, { body: "Any update?" });
```

Errors throw `SuppuoError` carrying the API envelope's `error.code`
(`NOT_FOUND`, `VALIDATION_ERROR`, `AUTH_REQUIRED`, …), the HTTP status,
and the `meta.requestId`.

See [suppuo.com/docs/sdk/js](https://suppuo.com/docs/sdk/js) for the
full method reference.

## Family

Sister to:
- [`forjio-suppuo`](https://pypi.org/project/forjio-suppuo/) (Python)
- [`hachimi-cat/suppuo-go`](https://github.com/hachimi-cat/suppuo-go) (Go)

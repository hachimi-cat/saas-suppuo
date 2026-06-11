# @forjio/suppuo

Typed JS/TS client for the [suppuo.com](https://suppuo.com) helpdesk REST API.

```bash
npm install @forjio/suppuo
```

```ts
import fs from "node:fs";
import { SuppuoClient } from "@forjio/suppuo";

// Bearer token from `token` or the SUPPUO_TOKEN env var — use an
// sk_live_… API key from Dashboard → Settings → API keys.
const client = new SuppuoClient({ token: "sk_live_xxx" });

// Tickets — agent workspace surface
const { tickets, counts, cursor, hasMore } = await client.tickets.list({
  status: "open",
  channel: "telegram",
  tag: "billing",
  q: "refund",
});
const ticket = await client.tickets.get(tickets[0].id);
await client.tickets.reply(ticket.id, { body: "On it!", isInternal: false });
await client.tickets.update(ticket.id, { status: "resolved", tags: ["billing", "vip"] });
const { tags } = await client.tickets.tags(); // distinct tags (autocomplete)

// Attachments — stage, bind to a reply, download
const meta = await client.attachments.upload({
  data: await fs.promises.readFile("invoice.pdf"), // Buffer or Uint8Array
  filename: "invoice.pdf",
  contentType: "application/pdf",
});
await client.tickets.reply(ticket.id, { body: "Attached.", attachmentIds: [meta.id] });
const file = await client.attachments.download(meta.id);

// Billing — current plan + upgrade checkout (tiers: free / starter / growth / business)
const { subscription, tiers } = await client.billing.get();
const { hostedUrl } = await client.billing.checkout("growth"); // redirect the browser here

// Channels — BYO integrations
const { integrations } = await client.channels.list();
await client.channels.create({ provider: "telegram_bot", botToken: "123456789:AAxxx" });
await client.channels.delete(integrations[0].id);

// Reports / settings / CSAT
const summary = await client.reports.summary({ days: 30 });
const automation = await client.settings.getAutomation();
await client.settings.putAutomation({ autoResponseEnabled: true, hideBranding: true });
const csat = await client.csat.stats();

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

## Endpoints covered

| Resource | Methods |
| --- | --- |
| `tickets` | `list` (status / assignee / tag / channel / priority / q / limit / cursor), `tags`, `get`, `create`, `reply` (with `attachmentIds`), `update` (status / priority / assigneeSub / tags) |
| `billing` | `get` (subscription + tier table), `checkout(tier)` → hosted checkout URL |
| `channels` | `list`, `create` (whatsapp_twilio / whatsapp_cloud / email_resend / telegram_bot / slack_webhook / discord_webhook), `delete` |
| `reports` | `summary({ days: 7 \| 30 \| 90 })` |
| `settings` | `getAutomation`, `putAutomation` (business hours, auto-response, hideBranding) |
| `csat` | `stats` |
| `attachments` | `upload` (raw bytes + filename, 8MB max), `download` |
| `cannedReplies` | `list`, `create`, `update`, `delete` |
| `public` | `submitTicket`, `getTicket`, `replyTicket` (no token) |

Errors throw `SuppuoError` carrying the API envelope's `error.code`
(`NOT_FOUND`, `VALIDATION_ERROR`, `AUTH_REQUIRED`, …), the HTTP status,
and the `meta.requestId`.

See [suppuo.com/docs/sdk/js](https://suppuo.com/docs/sdk/js) for the
full method reference.

## Family

Sister to:
- [`forjio-suppuo`](https://pypi.org/project/forjio-suppuo/) (Python)
- [`hachimi-cat/suppuo-go`](https://github.com/hachimi-cat/suppuo-go) (Go)

# suppuo-go

Typed Go client for the [suppuo.com](https://suppuo.com) helpdesk REST API.

Current version: **v0.2.0** — adds billing, channels, reports, settings,
CSAT, attachments, ticket tags + the full inbox filter set.

```bash
go get github.com/hachimi-cat/suppuo-go
```

```go
import (
	"context"
	"os"

	suppuo "github.com/hachimi-cat/suppuo-go"
)

// Bearer token from Config.Token or the SUPPUO_TOKEN env var — use an
// sk_live_… API key from Dashboard → Settings → API keys.
c := suppuo.New(suppuo.Config{Token: "sk_live_xxx"})
ctx := context.Background()

// Tickets — agent workspace surface
page, err := c.Tickets.List(ctx, &suppuo.TicketListParams{
	Status:  suppuo.StatusOpen,
	Channel: suppuo.ChannelTelegram,
	Tag:     "billing",
	Q:       "refund",
})
ticket, err := c.Tickets.Get(ctx, page.Tickets[0].ID)
_, err = c.Tickets.Reply(ctx, ticket.ID, suppuo.TicketReplyInput{Body: "On it!"})
status := suppuo.StatusResolved
tags := []string{"billing", "vip"}
_, err = c.Tickets.Update(ctx, ticket.ID, suppuo.TicketUpdateInput{Status: &status, Tags: &tags})
allTags, err := c.Tickets.Tags(ctx) // distinct tags (autocomplete feed)

// Attachments — stage, bind to a reply, download
data, _ := os.ReadFile("invoice.pdf")
meta, err := c.Attachments.Upload(ctx, suppuo.AttachmentUploadInput{
	Data: data, Filename: "invoice.pdf", ContentType: "application/pdf",
})
_, err = c.Tickets.Reply(ctx, ticket.ID, suppuo.TicketReplyInput{
	Body: "Attached.", AttachmentIDs: []string{meta.ID},
})
file, err := c.Attachments.Download(ctx, meta.ID)

// Billing — current plan + upgrade checkout (tiers: free / starter / growth / business)
info, err := c.Billing.Get(ctx)
out, err := c.Billing.Checkout(ctx, suppuo.TierGrowth) // redirect the browser to out.HostedURL

// Channels — BYO integrations
channels, err := c.Channels.List(ctx)
_, err = c.Channels.Create(ctx, suppuo.ChannelCreateInput{
	Provider: suppuo.ProviderTelegramBot, BotToken: "123456789:AAxxx",
})
err = c.Channels.Delete(ctx, channels.Integrations[0].ID)

// Reports / settings / CSAT
summary, err := c.Reports.Summary(ctx, 30)
automation, err := c.Settings.GetAutomation(ctx)
enabled, hide := true, true
_, err = c.Settings.PutAutomation(ctx, suppuo.AutomationSettingsPatch{
	AutoResponseEnabled: &enabled, HideBranding: &hide,
})
csat, err := c.CSAT.Stats(ctx)

// Canned replies
_, err = c.CannedReplies.Create(ctx, suppuo.CannedReplyInput{Title: "Refund policy", Body: "…"})

// Public (requester) surface — no token required
sub, err := c.Public.SubmitTicket(ctx, suppuo.SubmitTicketInput{
	AccountID: "acc_…",
	Subject:   "Order question",
	Body:      "Where is my order?",
	Email:     "customer@example.com",
})
view, err := c.Public.GetTicket(ctx, sub.AccessToken)
_, err = c.Public.ReplyTicket(ctx, sub.AccessToken, "Any update?")
```

## Endpoints covered

| Resource | Methods |
| --- | --- |
| `Tickets` | `List` (Status / Assignee / Tag / Channel / Priority / Q / Limit / Cursor), `Tags`, `Get`, `Create`, `Reply` (with `AttachmentIDs`), `Update` (Status / Priority / AssigneeSub / Tags) |
| `Billing` | `Get` (subscription + tier table), `Checkout(tier)` → hosted checkout URL |
| `Channels` | `List`, `Create` (whatsapp_twilio / whatsapp_cloud / email_resend / telegram_bot / slack_webhook / discord_webhook), `Delete` |
| `Reports` | `Summary(days)` (7 / 30 / 90) |
| `Settings` | `GetAutomation`, `PutAutomation` (business hours, auto-response, HideBranding) |
| `CSAT` | `Stats` |
| `Attachments` | `Upload` (raw bytes + filename, 8MB max), `Download` |
| `CannedReplies` | `List`, `Create`, `Update`, `Delete` |
| `Public` | `SubmitTicket`, `GetTicket`, `ReplyTicket` (no token) |

Failures return `*suppuo.Error` carrying the API envelope's `error.code`
(`NOT_FOUND`, `VALIDATION_ERROR`, `AUTH_REQUIRED`, …), the HTTP status,
and the `meta.requestId`.

## Family

Sister to:
- [`@forjio/suppuo`](https://www.npmjs.com/package/@forjio/suppuo) (JS/TS)
- [`forjio-suppuo`](https://pypi.org/project/forjio-suppuo/) (Python)

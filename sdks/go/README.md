# suppuo-go

Typed Go client for the [suppuo.com](https://suppuo.com) helpdesk REST API.

```bash
go get github.com/hachimi-cat/suppuo-go
```

```go
import (
	"context"
	"os"

	suppuo "github.com/hachimi-cat/suppuo-go"
)

// Bearer token from Config.Token or the SUPPUO_TOKEN env var.
c := suppuo.New(suppuo.Config{Token: os.Getenv("SUPPUO_TOKEN")})
ctx := context.Background()

// Agent workspace surface
page, err := c.Tickets.List(ctx, &suppuo.TicketListParams{Status: suppuo.StatusOpen})
ticket, err := c.Tickets.Get(ctx, page.Tickets[0].ID)
_, err = c.Tickets.Reply(ctx, ticket.ID, suppuo.TicketReplyInput{Body: "On it!"})
status := suppuo.StatusResolved
_, err = c.Tickets.Update(ctx, ticket.ID, suppuo.TicketUpdateInput{Status: &status})

// Canned replies
_, err = c.CannedReplies.Create(ctx, suppuo.CannedReplyInput{Title: "Refund policy", Body: "…"})

// Public (requester) surface — no token required
out, err := c.Public.SubmitTicket(ctx, suppuo.SubmitTicketInput{
	AccountID: "acc_…",
	Subject:   "Order question",
	Body:      "Where is my order?",
	Email:     "customer@example.com",
})
view, err := c.Public.GetTicket(ctx, out.AccessToken)
_, err = c.Public.ReplyTicket(ctx, out.AccessToken, "Any update?")
```

Failures return `*suppuo.Error` carrying the API envelope's `error.code`
(`NOT_FOUND`, `VALIDATION_ERROR`, `AUTH_REQUIRED`, …), the HTTP status,
and the `meta.requestId`.

## Family

Sister to:
- [`@forjio/suppuo`](https://www.npmjs.com/package/@forjio/suppuo) (JS/TS)
- [`forjio-suppuo`](https://pypi.org/project/forjio-suppuo/) (Python)

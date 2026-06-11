package suppuo

import (
	"context"
	"net/url"
	"strconv"
)

// TicketsResource is the agent workspace surface (Bearer auth).
type TicketsResource struct {
	c *Client
}

// TicketListParams filters Tickets.List.
type TicketListParams struct {
	// Status filters to one status ("open", "pending", "resolved",
	// "closed") or "all". Empty = all.
	Status string
	// Assignee is a Huudis sub, "me" (the caller), or "unassigned".
	Assignee string
	// Tag filters to tickets carrying the tag (exact, lowercase).
	Tag string
	// Channel filters by arrival channel ("web", "email", "whatsapp",
	// "telegram").
	Channel string
	// Priority filters by priority ("low", "normal", "high", "urgent").
	Priority string
	// Q is a free-text search across subject + requester email/name +
	// message bodies.
	Q string
	// Limit caps the page size (1-100, default 50).
	Limit int
	// Cursor is the opaque cursor from a previous page.
	Cursor string
}

// List calls GET /api/v1/tickets — newest-activity-first, with
// per-status counts.
func (r *TicketsResource) List(ctx context.Context, params *TicketListParams) (*TicketList, error) {
	q := url.Values{}
	if params != nil {
		if params.Status != "" {
			q.Set("status", params.Status)
		}
		if params.Assignee != "" {
			q.Set("assignee", params.Assignee)
		}
		if params.Tag != "" {
			q.Set("tag", params.Tag)
		}
		if params.Channel != "" {
			q.Set("channel", params.Channel)
		}
		if params.Priority != "" {
			q.Set("priority", params.Priority)
		}
		if params.Q != "" {
			q.Set("q", params.Q)
		}
		if params.Limit > 0 {
			q.Set("limit", strconv.Itoa(params.Limit))
		}
		if params.Cursor != "" {
			q.Set("cursor", params.Cursor)
		}
	}
	var out TicketList
	if err := r.c.do(ctx, "GET", "/api/v1/tickets", q, nil, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Tags calls GET /api/v1/tickets/tags — distinct tags across the
// workspace's tickets (autocomplete feed).
func (r *TicketsResource) Tags(ctx context.Context) ([]string, error) {
	var out struct {
		Tags []string `json:"tags"`
	}
	if err := r.c.do(ctx, "GET", "/api/v1/tickets/tags", nil, nil, false, &out); err != nil {
		return nil, err
	}
	return out.Tags, nil
}

// Get calls GET /api/v1/tickets/:id — full ticket incl. message thread.
func (r *TicketsResource) Get(ctx context.Context, id string) (*TicketWithMessages, error) {
	var out TicketWithMessages
	if err := r.c.do(ctx, "GET", "/api/v1/tickets/"+url.PathEscape(id), nil, nil, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// TicketCreateInput is the payload for Tickets.Create.
type TicketCreateInput struct {
	Subject        string `json:"subject"`
	Body           string `json:"body"`
	RequesterEmail string `json:"requesterEmail"`
	RequesterName  string `json:"requesterName,omitempty"`
	Priority       string `json:"priority,omitempty"`
	Channel        string `json:"channel,omitempty"`
}

// Create calls POST /api/v1/tickets — agent-logged ticket (e.g. an
// inquiry that arrived out-of-band, like WhatsApp).
func (r *TicketsResource) Create(ctx context.Context, input TicketCreateInput) (*Ticket, error) {
	var out Ticket
	if err := r.c.do(ctx, "POST", "/api/v1/tickets", nil, input, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// TicketReplyInput is the payload for Tickets.Reply. Stage files first
// via Attachments.Upload and pass their ids as AttachmentIDs.
type TicketReplyInput struct {
	Body          string   `json:"body"`
	IsInternal    bool     `json:"isInternal,omitempty"`
	AuthorName    string   `json:"authorName,omitempty"`
	AttachmentIDs []string `json:"attachmentIds,omitempty"`
}

// TicketReplyResult is the created message plus the ticket's new status.
type TicketReplyResult struct {
	Message TicketMessage `json:"message"`
	Status  string        `json:"status"`
}

// Reply calls POST /api/v1/tickets/:id/messages — agent reply (or
// internal note when IsInternal is true).
func (r *TicketsResource) Reply(ctx context.Context, id string, input TicketReplyInput) (*TicketReplyResult, error) {
	var out TicketReplyResult
	path := "/api/v1/tickets/" + url.PathEscape(id) + "/messages"
	if err := r.c.do(ctx, "POST", path, nil, input, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// TicketUpdateInput is the payload for Tickets.Update. Nil fields are
// omitted; set AssigneeSub to a pointer to "" or a sub to (un)assign.
// Tags replaces the full tag list (normalized server-side); a pointer
// to an empty slice clears all tags.
type TicketUpdateInput struct {
	Status      *string   `json:"status,omitempty"`
	Priority    *string   `json:"priority,omitempty"`
	AssigneeSub *string   `json:"assigneeSub,omitempty"`
	Tags        *[]string `json:"tags,omitempty"`
}

// Update calls PATCH /api/v1/tickets/:id — status / priority /
// assignee / tags.
func (r *TicketsResource) Update(ctx context.Context, id string, input TicketUpdateInput) (*Ticket, error) {
	var out Ticket
	if err := r.c.do(ctx, "PATCH", "/api/v1/tickets/"+url.PathEscape(id), nil, input, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

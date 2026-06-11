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
	// Limit caps the page size (1-100, default 50).
	Limit int
}

// List calls GET /api/v1/tickets — newest-activity-first, with
// per-status counts.
func (r *TicketsResource) List(ctx context.Context, params *TicketListParams) (*TicketList, error) {
	q := url.Values{}
	if params != nil {
		if params.Status != "" {
			q.Set("status", params.Status)
		}
		if params.Limit > 0 {
			q.Set("limit", strconv.Itoa(params.Limit))
		}
	}
	var out TicketList
	if err := r.c.do(ctx, "GET", "/api/v1/tickets", q, nil, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
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

// TicketReplyInput is the payload for Tickets.Reply.
type TicketReplyInput struct {
	Body       string `json:"body"`
	IsInternal bool   `json:"isInternal,omitempty"`
	AuthorName string `json:"authorName,omitempty"`
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
type TicketUpdateInput struct {
	Status      *string `json:"status,omitempty"`
	Priority    *string `json:"priority,omitempty"`
	AssigneeSub *string `json:"assigneeSub,omitempty"`
}

// Update calls PATCH /api/v1/tickets/:id — status / priority / assignee.
func (r *TicketsResource) Update(ctx context.Context, id string, input TicketUpdateInput) (*Ticket, error) {
	var out Ticket
	if err := r.c.do(ctx, "PATCH", "/api/v1/tickets/"+url.PathEscape(id), nil, input, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

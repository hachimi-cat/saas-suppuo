package suppuo

import (
	"context"
	"net/url"
)

// PublicResource is the requester-facing, UNauthenticated surface —
// the hosted form + tokenized status view. No Bearer token needed.
type PublicResource struct {
	c *Client
}

// SubmitTicketInput is the payload for Public.SubmitTicket.
type SubmitTicketInput struct {
	// AccountID is the workspace's opaque acc_* id carried by the
	// hosted form URL.
	AccountID string `json:"accountId"`
	Subject   string `json:"subject"`
	Body      string `json:"body"`
	Email     string `json:"email"`
	Name      string `json:"name,omitempty"`
}

// SubmitTicketResult carries the requester's only credential: the
// access token for the tokenized status view.
type SubmitTicketResult struct {
	Number      int    `json:"number"`
	AccessToken string `json:"accessToken"`
}

// SubmitTicket calls POST /api/v1/public/tickets — submit a ticket to
// a workspace's hosted form.
func (r *PublicResource) SubmitTicket(ctx context.Context, input SubmitTicketInput) (*SubmitTicketResult, error) {
	var out SubmitTicketResult
	if err := r.c.do(ctx, "POST", "/api/v1/public/tickets", nil, input, true, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetTicket calls GET /api/v1/public/tickets/:accessToken — the
// tokenized status view (public messages only; internal notes are
// never exposed).
func (r *PublicResource) GetTicket(ctx context.Context, accessToken string) (*PublicTicketView, error) {
	var out PublicTicketView
	path := "/api/v1/public/tickets/" + url.PathEscape(accessToken)
	if err := r.c.do(ctx, "GET", path, nil, nil, true, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// PublicReplyResult is the created message id plus the ticket's new
// status.
type PublicReplyResult struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

// ReplyTicket calls POST /api/v1/public/tickets/:accessToken/messages —
// a requester reply on their own ticket.
func (r *PublicResource) ReplyTicket(ctx context.Context, accessToken string, body string) (*PublicReplyResult, error) {
	var out PublicReplyResult
	path := "/api/v1/public/tickets/" + url.PathEscape(accessToken) + "/messages"
	payload := map[string]string{"body": body}
	if err := r.c.do(ctx, "POST", path, nil, payload, true, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

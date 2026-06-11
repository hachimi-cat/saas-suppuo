package suppuo

import (
	"context"
	"net/url"
)

// CannedRepliesResource manages per-workspace saved reply snippets
// (Bearer auth).
type CannedRepliesResource struct {
	c *Client
}

// List calls GET /api/v1/canned-replies.
func (r *CannedRepliesResource) List(ctx context.Context) ([]CannedReply, error) {
	var out struct {
		CannedReplies []CannedReply `json:"cannedReplies"`
	}
	if err := r.c.do(ctx, "GET", "/api/v1/canned-replies", nil, nil, false, &out); err != nil {
		return nil, err
	}
	return out.CannedReplies, nil
}

// CannedReplyInput is the payload for CannedReplies.Create.
type CannedReplyInput struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// Create calls POST /api/v1/canned-replies.
func (r *CannedRepliesResource) Create(ctx context.Context, input CannedReplyInput) (*CannedReply, error) {
	var out CannedReply
	if err := r.c.do(ctx, "POST", "/api/v1/canned-replies", nil, input, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CannedReplyPatch is the payload for CannedReplies.Update. Nil fields
// are omitted.
type CannedReplyPatch struct {
	Title *string `json:"title,omitempty"`
	Body  *string `json:"body,omitempty"`
}

// Update calls PATCH /api/v1/canned-replies/:id.
func (r *CannedRepliesResource) Update(ctx context.Context, id string, patch CannedReplyPatch) (*CannedReply, error) {
	var out CannedReply
	path := "/api/v1/canned-replies/" + url.PathEscape(id)
	if err := r.c.do(ctx, "PATCH", path, nil, patch, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete calls DELETE /api/v1/canned-replies/:id.
func (r *CannedRepliesResource) Delete(ctx context.Context, id string) error {
	path := "/api/v1/canned-replies/" + url.PathEscape(id)
	return r.c.do(ctx, "DELETE", path, nil, nil, false, nil)
}

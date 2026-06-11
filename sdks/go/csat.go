package suppuo

import "context"

// CSATResource is the agent-side CSAT aggregates surface (Bearer auth).
type CSATResource struct {
	c *Client
}

// CSATStats is the workspace-lifetime satisfaction aggregate.
type CSATStats struct {
	// Average score 1..3; nil with no responses yet.
	Average *float64 `json:"average"`
	Count   int      `json:"count"`
}

// Stats calls GET /api/v1/csat/stats.
func (r *CSATResource) Stats(ctx context.Context) (*CSATStats, error) {
	var out CSATStats
	if err := r.c.do(ctx, "GET", "/api/v1/csat/stats", nil, nil, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

package suppuo

import "context"

// BillingResource is the workspace plan + Plugipay checkout surface
// (Bearer auth).
type BillingResource struct {
	c *Client
}

// TierDef is one row of the tier table (ids: free / starter / growth /
// business).
type TierDef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// PriceIDR is whole rupiah per month. 0 = free.
	PriceIDR int      `json:"priceIdr"`
	Blurb    string   `json:"blurb"`
	Features []string `json:"features"`
	// AgentLimit is the agent-seat limit (Huudis workspace members).
	AgentLimit int `json:"agentLimit"`
	// WANumberLimit is how many connected WhatsApp numbers (BYO
	// integrations) the tier allows.
	WANumberLimit int `json:"waNumberLimit"`
}

// BillingSubscription is the workspace's current subscription. A
// workspace with no purchase history reports tier "free" with a nil ID.
type BillingSubscription struct {
	ID                        *string `json:"id"`
	AccountID                 string  `json:"accountId"`
	Tier                      string  `json:"tier"`   // free | starter | growth | business
	Status                    string  `json:"status"` // active | past_due | canceled
	PlugipayCheckoutSessionID *string `json:"plugipayCheckoutSessionId"`
	CurrentPeriodEnd          *string `json:"currentPeriodEnd"`
}

// BillingInfo is the GET /api/v1/billing response.
type BillingInfo struct {
	Subscription BillingSubscription `json:"subscription"`
	// EarlyAccess: paid tiers are recorded truthfully but no limits are
	// enforced yet.
	EarlyAccess bool      `json:"earlyAccess"`
	Tiers       []TierDef `json:"tiers"`
}

// Get calls GET /api/v1/billing — current subscription + the tier table.
func (r *BillingResource) Get(ctx context.Context) (*BillingInfo, error) {
	var out BillingInfo
	if err := r.c.do(ctx, "GET", "/api/v1/billing", nil, nil, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CheckoutResult carries the Plugipay hosted checkout to redirect the
// browser to.
type CheckoutResult struct {
	CheckoutSessionID string `json:"checkoutSessionId"`
	HostedURL         string `json:"hostedUrl"`
}

// Checkout calls POST /api/v1/billing/checkout for a paid tier
// ("starter" | "growth" | "business"); redirect the browser to
// HostedURL.
func (r *BillingResource) Checkout(ctx context.Context, tier string) (*CheckoutResult, error) {
	var out CheckoutResult
	payload := map[string]string{"tier": tier}
	if err := r.c.do(ctx, "POST", "/api/v1/billing/checkout", nil, payload, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

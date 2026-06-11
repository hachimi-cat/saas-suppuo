package suppuo

import (
	"context"
	"net/url"
	"strconv"
)

// ReportsResource is the on-the-fly support analytics surface (Bearer
// auth).
type ReportsResource struct {
	c *Client
}

// DailyCount is one day in the created-tickets series (gap-filled).
type DailyCount struct {
	Day   string `json:"day"` // YYYY-MM-DD (UTC)
	Count int    `json:"count"`
}

// LatencyStats summarizes a response-time distribution in seconds.
// Median/P90 are nil when no samples exist in the window.
type LatencyStats struct {
	MedianSeconds *float64 `json:"medianSeconds"`
	P90Seconds    *float64 `json:"p90Seconds"`
	Count         int      `json:"count"`
}

// ReportsSummary is the GET /api/v1/reports/summary response.
type ReportsSummary struct {
	PeriodDays    int          `json:"periodDays"`
	CreatedPerDay []DailyCount `json:"createdPerDay"`
	CreatedTotal  int          `json:"createdTotal"`
	ByChannel     []struct {
		Channel string `json:"channel"`
		Count   int    `json:"count"`
	} `json:"byChannel"`
	// ByStatus is a CURRENT snapshot across all tickets (not
	// period-scoped).
	ByStatus []struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	} `json:"byStatus"`
	OpenNow          int          `json:"openNow"`
	ResolvedInPeriod int          `json:"resolvedInPeriod"`
	FirstResponse    LatencyStats `json:"firstResponse"`
	Resolution       LatencyStats `json:"resolution"`
	CSAT             struct {
		Average      *float64       `json:"average"` // 1..3
		Count        int            `json:"count"`
		Distribution map[string]int `json:"distribution"`
	} `json:"csat"`
}

// Summary calls GET /api/v1/reports/summary?days= — support analytics
// for the window. days is 7, 30 (default when 0), or 90.
func (r *ReportsResource) Summary(ctx context.Context, days int) (*ReportsSummary, error) {
	q := url.Values{}
	if days > 0 {
		q.Set("days", strconv.Itoa(days))
	}
	var out ReportsSummary
	if err := r.c.do(ctx, "GET", "/api/v1/reports/summary", q, nil, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

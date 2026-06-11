// Package suppuo is the Go SDK for the suppuo.com helpdesk REST API.
// Sister to @forjio/suppuo (JS) and forjio-suppuo (Python).
//
// Auth = Bearer token — an sk_live_… API key from the dashboard (or a
// Huudis-minted access token). Pass Config.Token or set SUPPUO_TOKEN.
// The Public resource (requester-facing hosted-form endpoints) needs
// no token at all.
//
// Every response rides the Forjio envelope {data, error, meta}; the
// client unwraps it and returns *Error (carrying the envelope's
// error.code) on failure.
package suppuo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// Client is the Suppuo typed client.
type Client struct {
	token   string
	baseURL string
	httpc   *http.Client

	// Resource namespaces — mirror the JS + Python SDKs.
	Tickets       *TicketsResource
	CannedReplies *CannedRepliesResource
	Billing       *BillingResource
	Channels      *ChannelsResource
	Reports       *ReportsResource
	Settings      *SettingsResource
	CSAT          *CSATResource
	Attachments   *AttachmentsResource
	Public        *PublicResource
}

// Config holds the credentials + endpoint overrides.
type Config struct {
	// Token is the Bearer access token (Huudis-minted JWT). Defaults to
	// the SUPPUO_TOKEN env var. Optional — Public works without it.
	Token string
	// BaseURL overrides the API base. Default: https://suppuo.com.
	BaseURL string
	// HTTP overrides the http.Client. Default: 30s timeout.
	HTTP *http.Client
}

// New constructs a Suppuo client.
//
// Example:
//
//	c := suppuo.New(suppuo.Config{Token: os.Getenv("SUPPUO_TOKEN")})
//	page, err := c.Tickets.List(ctx, &suppuo.TicketListParams{Status: "open"})
func New(cfg Config) *Client {
	token := cfg.Token
	if token == "" {
		token = os.Getenv("SUPPUO_TOKEN")
	}
	base := cfg.BaseURL
	if base == "" {
		base = "https://suppuo.com"
	}
	httpc := cfg.HTTP
	if httpc == nil {
		httpc = &http.Client{Timeout: 30 * time.Second}
	}
	c := &Client{
		token:   token,
		baseURL: strings.TrimRight(base, "/"),
		httpc:   httpc,
	}
	c.Tickets = &TicketsResource{c: c}
	c.CannedReplies = &CannedRepliesResource{c: c}
	c.Billing = &BillingResource{c: c}
	c.Channels = &ChannelsResource{c: c}
	c.Reports = &ReportsResource{c: c}
	c.Settings = &SettingsResource{c: c}
	c.CSAT = &CSATResource{c: c}
	c.Attachments = &AttachmentsResource{c: c}
	c.Public = &PublicResource{c: c}
	return c
}

// envelope mirrors the Forjio data/error/meta API envelope.
type envelope struct {
	Data  json.RawMessage `json:"data"`
	Error *envelopeError  `json:"error"`
	Meta  *envelopeMeta   `json:"meta"`
}

type envelopeError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Param   string `json:"param,omitempty"`
	DocURL  string `json:"docUrl,omitempty"`
}

type envelopeMeta struct {
	RequestID string `json:"requestId,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

// do builds the request, attaches the bearer (unless noAuth), parses
// the envelope, and decodes the data slot into out (pointer; nil to
// ignore the body).
func (c *Client) do(
	ctx context.Context,
	method, path string,
	query url.Values,
	body any,
	noAuth bool,
	out any,
) error {
	u := c.baseURL + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}

	var bodyReader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return &Error{Status: 0, Code: "SERIALIZE_FAILED", Message: err.Error()}
		}
		bodyReader = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, u, bodyReader)
	if err != nil {
		return &Error{Status: 0, Code: "REQUEST_BUILD_FAILED", Message: err.Error()}
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if !noAuth {
		if c.token == "" {
			return &Error{
				Status:  0,
				Code:    "AUTH_REQUIRED",
				Message: "no token configured: set Config.Token or SUPPUO_TOKEN",
			}
		}
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	res, err := c.httpc.Do(req)
	if err != nil {
		return &Error{Status: 0, Code: "NETWORK_ERROR", Message: err.Error()}
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)

	var env envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return &Error{
			Status:  res.StatusCode,
			Code:    "INVALID_RESPONSE",
			Message: fmt.Sprintf("non-JSON response (HTTP %d)", res.StatusCode),
		}
	}

	requestID := ""
	if env.Meta != nil {
		requestID = env.Meta.RequestID
	}
	if res.StatusCode >= 400 || env.Error != nil {
		code := "UNKNOWN"
		message := fmt.Sprintf("HTTP %d", res.StatusCode)
		param := ""
		if env.Error != nil {
			if env.Error.Code != "" {
				code = env.Error.Code
			}
			if env.Error.Message != "" {
				message = env.Error.Message
			}
			param = env.Error.Param
		}
		return &Error{
			Status:    res.StatusCode,
			Code:      code,
			Message:   message,
			RequestID: requestID,
			Param:     param,
		}
	}

	if out != nil && len(env.Data) > 0 {
		if err := json.Unmarshal(env.Data, out); err != nil {
			return &Error{
				Status:    res.StatusCode,
				Code:      "DECODE_FAILED",
				Message:   err.Error(),
				RequestID: requestID,
			}
		}
	}
	return nil
}

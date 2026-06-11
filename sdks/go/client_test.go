package suppuo

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNew(t *testing.T) {
	c := New(Config{Token: "test"})
	if c == nil {
		t.Fatal("client is nil")
	}
	if c.Tickets == nil || c.CannedReplies == nil || c.Public == nil {
		t.Fatal("resource namespaces not wired")
	}
}

func TestTicketsListUnwrapsEnvelope(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/tickets" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer tok_123" {
			t.Errorf("auth header = %q", got)
		}
		if got := r.URL.Query().Get("status"); got != "open" {
			t.Errorf("status = %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":  map[string]any{"tickets": []any{}, "counts": map[string]int{"open": 2}},
			"error": nil,
			"meta":  map[string]any{"requestId": "req_t", "timestamp": "now"},
		})
	}))
	defer srv.Close()

	c := New(Config{Token: "tok_123", BaseURL: srv.URL})
	out, err := c.Tickets.List(context.Background(), &TicketListParams{Status: "open", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if out.Counts["open"] != 2 {
		t.Errorf("counts = %v", out.Counts)
	}
}

func TestEnvelopeErrorBecomesTypedError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":  nil,
			"error": map[string]any{"code": "NOT_FOUND", "message": "ticket not found"},
			"meta":  map[string]any{"requestId": "req_x", "timestamp": "now"},
		})
	}))
	defer srv.Close()

	c := New(Config{Token: "tok", BaseURL: srv.URL})
	_, err := c.Tickets.Get(context.Background(), "tkt_missing")
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected *Error, got %T", err)
	}
	if apiErr.Code != "NOT_FOUND" || apiErr.Status != 404 || apiErr.RequestID != "req_x" {
		t.Errorf("unexpected error: %+v", apiErr)
	}
}

func TestPublicNeedsNoToken(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "" {
			t.Errorf("unexpected auth header %q", got)
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":  map[string]any{"number": 1, "accessToken": "at_x"},
			"error": nil,
			"meta":  map[string]any{"requestId": "req_p", "timestamp": "now"},
		})
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL, Token: ""})
	out, err := c.Public.SubmitTicket(context.Background(), SubmitTicketInput{
		AccountID: "acc_x", Subject: "s", Body: "b", Email: "e@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.AccessToken != "at_x" {
		t.Errorf("accessToken = %q", out.AccessToken)
	}
}

func TestAuthedWithoutTokenFailsFast(t *testing.T) {
	t.Setenv("SUPPUO_TOKEN", "")
	c := New(Config{BaseURL: "http://127.0.0.1:0"})
	_, err := c.CannedReplies.List(context.Background())
	var apiErr *Error
	if !errors.As(err, &apiErr) || apiErr.Code != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %v", err)
	}
}

func TestTicketsListSendsFilterParams(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		for key, want := range map[string]string{
			"assignee": "me", "tag": "billing", "channel": "telegram",
			"priority": "high", "q": "refund", "cursor": "cur_abc",
		} {
			if got := q.Get(key); got != want {
				t.Errorf("%s = %q, want %q", key, got, want)
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":  map[string]any{"tickets": []any{}, "counts": map[string]int{}, "cursor": nil, "hasMore": false},
			"error": nil,
			"meta":  map[string]any{"requestId": "req_f", "timestamp": "now"},
		})
	}))
	defer srv.Close()

	c := New(Config{Token: "tok", BaseURL: srv.URL})
	out, err := c.Tickets.List(context.Background(), &TicketListParams{
		Assignee: "me", Tag: "billing", Channel: ChannelTelegram,
		Priority: PriorityHigh, Q: "refund", Cursor: "cur_abc",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.HasMore {
		t.Errorf("hasMore = true, want false")
	}
}

func TestBillingGetAndCheckout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/billing":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{
					"subscription": map[string]any{"id": nil, "accountId": "acc_1", "tier": "free", "status": "active"},
					"earlyAccess":  true,
					"tiers":        []any{map[string]any{"id": "growth", "name": "Growth", "priceIdr": 299000}},
				},
				"error": nil,
				"meta":  map[string]any{"requestId": "req_b", "timestamp": "now"},
			})
		case "/api/v1/billing/checkout":
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["tier"] != "growth" {
				t.Errorf("tier = %q", body["tier"])
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data":  map[string]any{"checkoutSessionId": "cs_1", "hostedUrl": "https://pay.example/cs_1"},
				"error": nil,
				"meta":  map[string]any{"requestId": "req_c", "timestamp": "now"},
			})
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
		}
	}))
	defer srv.Close()

	c := New(Config{Token: "tok", BaseURL: srv.URL})
	info, err := c.Billing.Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if info.Subscription.Tier != TierFree || len(info.Tiers) != 1 || info.Tiers[0].ID != TierGrowth {
		t.Errorf("unexpected billing info: %+v", info)
	}
	out, err := c.Billing.Checkout(context.Background(), TierGrowth)
	if err != nil {
		t.Fatal(err)
	}
	if out.HostedURL != "https://pay.example/cs_1" {
		t.Errorf("hostedUrl = %q", out.HostedURL)
	}
}

func TestAttachmentUploadAndDownload(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "POST" && r.URL.Path == "/api/v1/attachments":
			if got := r.Header.Get("X-Filename"); got != "report.pdf" {
				t.Errorf("X-Filename = %q", got)
			}
			if got := r.Header.Get("Content-Type"); got != "application/pdf" {
				t.Errorf("Content-Type = %q", got)
			}
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data":  map[string]any{"id": "att_1", "filename": "report.pdf", "contentType": "application/pdf", "size": 3},
				"error": nil,
				"meta":  map[string]any{"requestId": "req_a", "timestamp": "now"},
			})
		case r.Method == "GET" && r.URL.Path == "/api/v1/attachments/att_1":
			w.Header().Set("Content-Type", "application/pdf")
			w.Header().Set("Content-Disposition", `attachment; filename="report.pdf"`)
			_, _ = w.Write([]byte{1, 2, 3})
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
	}))
	defer srv.Close()

	c := New(Config{Token: "tok", BaseURL: srv.URL})
	meta, err := c.Attachments.Upload(context.Background(), AttachmentUploadInput{
		Data: []byte{1, 2, 3}, Filename: "report.pdf", ContentType: "application/pdf",
	})
	if err != nil {
		t.Fatal(err)
	}
	if meta.ID != "att_1" {
		t.Errorf("id = %q", meta.ID)
	}
	dl, err := c.Attachments.Download(context.Background(), "att_1")
	if err != nil {
		t.Fatal(err)
	}
	if dl.Filename != "report.pdf" || dl.ContentType != "application/pdf" || len(dl.Data) != 3 {
		t.Errorf("unexpected download: %+v", dl)
	}
}

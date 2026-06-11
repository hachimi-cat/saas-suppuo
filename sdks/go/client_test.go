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

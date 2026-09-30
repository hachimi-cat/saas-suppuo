package suppuo

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Client.API (api_generated.go) goes through apigenRequest: the same bearer
// and envelope handling as every hand-written call.

type apigenSeen struct {
	method, uri, auth, contentType string
	body                           []byte
}

func apigenServer(t *testing.T, status int, env map[string]any) (*httptest.Server, *[]apigenSeen) {
	t.Helper()
	var seen []apigenSeen
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		seen = append(seen, apigenSeen{r.Method, r.URL.RequestURI(), r.Header.Get("Authorization"), r.Header.Get("Content-Type"), body})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(env)
	}))
	t.Cleanup(srv.Close)
	return srv, &seen
}

func apigenOK(data any) map[string]any {
	return map[string]any{"data": data, "error": nil, "meta": map[string]any{"requestId": "req_ok"}}
}

func TestAPI_ListSendsQueryAndToken(t *testing.T) {
	srv, seen := apigenServer(t, 200, apigenOK([]any{map[string]any{"id": "tkt_1"}}))
	c := New(Config{Token: "sk_live_test", BaseURL: srv.URL})
	data, err := c.API.TicketsList(context.Background(), &TicketsListArgs{Priority: Ptr("high"), Limit: Ptr(20), Q: Ptr("refund please")})
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != `[{"id":"tkt_1"}]` {
		t.Fatalf("data = %s", data)
	}
	r := (*seen)[0]
	if r.method != "GET" || r.uri != "/api/v1/tickets?limit=20&priority=high&q=refund+please" || len(r.body) != 0 || r.auth != "Bearer sk_live_test" {
		t.Fatalf("request = %+v", r)
	}
}

func TestAPI_CreateSendsBody(t *testing.T) {
	srv, seen := apigenServer(t, 201, apigenOK(map[string]any{"id": "tkt_2"}))
	c := New(Config{Token: "sk_live_test", BaseURL: srv.URL})
	_, err := c.API.TicketsCreate(context.Background(), &TicketsCreateArgs{
		Subject: "Refund", BodyField: "Please refund order 12", RequesterEmail: "a@b.co", Channel: Ptr("email"),
	})
	if err != nil {
		t.Fatal(err)
	}
	r := (*seen)[0]
	if r.method != "POST" || r.uri != "/api/v1/tickets" || r.auth != "Bearer sk_live_test" || r.contentType != "application/json" {
		t.Fatalf("request = %+v", r)
	}
	if string(r.body) != `{"body":"Please refund order 12","channel":"email","requesterEmail":"a@b.co","subject":"Refund"}` {
		t.Fatalf("body = %s", r.body)
	}
}

func TestAPI_OneOfSeveralShapesBody(t *testing.T) {
	// POST /channels takes one of several shapes (anyOf): every shape's fields are offered.
	srv, seen := apigenServer(t, 201, apigenOK(map[string]any{"id": "ch_1"}))
	c := New(Config{Token: "sk_live_test", BaseURL: srv.URL})
	_, err := c.API.ChannelsCreate(context.Background(), &ChannelsCreateArgs{Provider: Ptr("telegram_bot"), BotToken: Ptr("123:abc")})
	if err != nil {
		t.Fatal(err)
	}
	if b := string((*seen)[0].body); b != `{"botToken":"123:abc","provider":"telegram_bot"}` {
		t.Fatalf("body = %s", b)
	}
}

func TestAPI_PublicRouteSendsNoToken(t *testing.T) {
	srv, seen := apigenServer(t, 201, apigenOK(map[string]any{"accessToken": "tok"}))
	c := New(Config{Token: "sk_live_test", BaseURL: srv.URL})
	_, err := c.API.PublicCreateTickets(context.Background(), &PublicCreateTicketsArgs{AccountID: "acc_1", Subject: "Hi", BodyField: "Help", Email: "a@b.co"})
	if err != nil {
		t.Fatal(err)
	}
	if r := (*seen)[0]; r.uri != "/api/v1/public/tickets" || r.auth != "" {
		t.Fatalf("request = %+v", r)
	}
}

func TestAPI_RequiredFieldMissing(t *testing.T) {
	srv, seen := apigenServer(t, 200, apigenOK(nil))
	c := New(Config{Token: "sk_live_test", BaseURL: srv.URL})
	_, err := c.API.TicketsCreate(context.Background(), &TicketsCreateArgs{Subject: "Refund", RequesterEmail: "a@b.co"})
	if err == nil || !strings.Contains(err.Error(), "BodyField") {
		t.Fatalf("err = %v, want a missing BodyField", err)
	}
	if len(*seen) != 0 {
		t.Fatalf("sent %d requests", len(*seen))
	}
}

func TestAPI_ErrorEnvelope(t *testing.T) {
	srv, _ := apigenServer(t, 404, map[string]any{"data": nil, "error": map[string]any{"code": "NOT_FOUND", "message": "nope"}, "meta": map[string]any{"requestId": "req_9"}})
	_, err := New(Config{Token: "sk_live_test", BaseURL: srv.URL}).API.TicketsGet(context.Background(), "tkt/x")
	e, ok := err.(*Error)
	if !ok || e.Status != 404 || e.Code != "NOT_FOUND" || e.RequestID != "req_9" {
		t.Fatalf("err = %#v", err)
	}
}

package suppuo

// Ticket statuses.
const (
	StatusOpen     = "open"
	StatusPending  = "pending"
	StatusResolved = "resolved"
	StatusClosed   = "closed"
)

// Ticket priorities.
const (
	PriorityLow    = "low"
	PriorityNormal = "normal"
	PriorityHigh   = "high"
	PriorityUrgent = "urgent"
)

// Ticket channels.
const (
	ChannelWeb      = "web"
	ChannelEmail    = "email"
	ChannelWhatsApp = "whatsapp"
)

// Ticket is a helpdesk ticket as returned by the agent surface.
type Ticket struct {
	ID             string  `json:"id"`
	AccountID      string  `json:"accountId"`
	Number         int     `json:"number"`
	Subject        string  `json:"subject"`
	Status         string  `json:"status"`
	Priority       string  `json:"priority"`
	Channel        string  `json:"channel"`
	RequesterEmail *string `json:"requesterEmail"`
	RequesterName  *string `json:"requesterName"`
	RequesterPhone *string `json:"requesterPhone,omitempty"`
	AssigneeSub    *string `json:"assigneeSub"`
	AccessToken    string  `json:"accessToken"`
	LastMessageAt  string  `json:"lastMessageAt"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
}

// TicketMessage is one message on a ticket's thread.
type TicketMessage struct {
	ID         string  `json:"id"`
	TicketID   string  `json:"ticketId"`
	AuthorType string  `json:"authorType"` // "agent" | "requester"
	AuthorSub  *string `json:"authorSub,omitempty"`
	AuthorName *string `json:"authorName"`
	Body       string  `json:"body"`
	IsInternal bool    `json:"isInternal"`
	CreatedAt  string  `json:"createdAt"`
}

// TicketWithMessages is a ticket including its full message thread.
type TicketWithMessages struct {
	Ticket
	Messages []TicketMessage `json:"messages"`
}

// TicketList is the list response: tickets plus per-status counts for
// the whole workspace.
type TicketList struct {
	Tickets []Ticket       `json:"tickets"`
	Counts  map[string]int `json:"counts"`
}

// CannedReply is a per-workspace saved reply snippet.
type CannedReply struct {
	ID        string `json:"id"`
	AccountID string `json:"accountId"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// PublicTicketView is the tokenized requester-facing status view —
// public messages only, internal notes are never exposed.
type PublicTicketView struct {
	Number    int                   `json:"number"`
	Subject   string                `json:"subject"`
	Status    string                `json:"status"`
	CreatedAt string                `json:"createdAt"`
	Messages  []PublicTicketMessage `json:"messages"`
}

// PublicTicketMessage is one public message in the requester view.
type PublicTicketMessage struct {
	ID         string  `json:"id"`
	AuthorType string  `json:"authorType"`
	AuthorName *string `json:"authorName"`
	Body       string  `json:"body"`
	CreatedAt  string  `json:"createdAt"`
}

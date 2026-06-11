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
	ChannelTelegram = "telegram"
)

// Billing tiers.
const (
	TierFree     = "free"
	TierStarter  = "starter"
	TierGrowth   = "growth"
	TierBusiness = "business"
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
	// RequesterExternalID is the channel-native requester identity for
	// non-phone channels — the Telegram chat id for telegram tickets.
	RequesterExternalID *string `json:"requesterExternalId,omitempty"`
	AssigneeSub         *string `json:"assigneeSub"`
	// Tags are free-form labels (normalized server-side: trimmed,
	// lowercased, deduped; max 10 tags x 40 chars).
	Tags          []string `json:"tags"`
	AccessToken   string   `json:"accessToken"`
	LastMessageAt string   `json:"lastMessageAt"`
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
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
	// Attachments carries display-safe metadata (present on Tickets.Get).
	Attachments []AttachmentMeta `json:"attachments,omitempty"`
}

// TicketWithMessages is a ticket including its full message thread.
type TicketWithMessages struct {
	Ticket
	Messages []TicketMessage `json:"messages"`
}

// TicketList is the list response: tickets plus per-status counts for
// the whole workspace and a keyset cursor for the next page.
type TicketList struct {
	Tickets []Ticket       `json:"tickets"`
	Counts  map[string]int `json:"counts"`
	// Cursor is the opaque cursor for the next page (nil on the last page).
	Cursor  *string `json:"cursor"`
	HasMore bool    `json:"hasMore"`
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

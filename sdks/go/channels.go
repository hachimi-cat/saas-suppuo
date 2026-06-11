package suppuo

import (
	"context"
	"net/url"
)

// Channel providers.
const (
	ProviderWhatsAppTwilio = "whatsapp_twilio"
	ProviderWhatsAppCloud  = "whatsapp_cloud"
	ProviderEmailResend    = "email_resend"
	ProviderTelegramBot    = "telegram_bot"
	ProviderSlackWebhook   = "slack_webhook"
	ProviderDiscordWebhook = "discord_webhook"
)

// ChannelsResource manages per-workspace BYO channel integrations
// (Bearer auth). Credentials are validated live against the provider
// before an integration activates and are never included in responses.
type ChannelsResource struct {
	c *Client
}

// ChannelIntegration is one connected channel (credentials excluded).
type ChannelIntegration struct {
	ID          string  `json:"id"`
	Provider    string  `json:"provider"`
	ExternalID  *string `json:"externalId"`
	DisplayName string  `json:"displayName"`
	Status      string  `json:"status"`
	Config      any     `json:"config"`
	LastError   *string `json:"lastError"`
	CreatedAt   string  `json:"createdAt"`
}

// ChannelList is the GET /api/v1/channels response.
type ChannelList struct {
	Integrations []ChannelIntegration `json:"integrations"`
	// Platform reports whether Suppuo itself has shared WhatsApp/email
	// credentials configured (BYO integrations work regardless).
	Platform struct {
		WhatsApp bool `json:"whatsapp"`
		Email    bool `json:"email"`
	} `json:"platform"`
}

// List calls GET /api/v1/channels.
func (r *ChannelsResource) List(ctx context.Context) (*ChannelList, error) {
	var out ChannelList
	if err := r.c.do(ctx, "GET", "/api/v1/channels", nil, nil, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ChannelCreateInput is the payload for Channels.Create. Provider is
// required; fill the fields for that provider and leave the rest zero:
//
//	whatsapp_twilio — AccountSID, AuthToken, WhatsAppNumber
//	whatsapp_cloud  — AccessToken, PhoneNumberID, DisplayNumber
//	                  (+ optional WABAID, VerifyToken, AppSecret)
//	email_resend    — APIKey, FromEmail (+ optional FromName)
//	telegram_bot    — BotToken
//	slack_webhook   — WebhookURL
//	discord_webhook — WebhookURL
type ChannelCreateInput struct {
	Provider    string `json:"provider"`
	DisplayName string `json:"displayName,omitempty"`

	// whatsapp_twilio
	AccountSID     string `json:"accountSid,omitempty"`
	AuthToken      string `json:"authToken,omitempty"`
	WhatsAppNumber string `json:"whatsappNumber,omitempty"`

	// whatsapp_cloud
	AccessToken   string `json:"accessToken,omitempty"`
	PhoneNumberID string `json:"phoneNumberId,omitempty"`
	WABAID        string `json:"wabaId,omitempty"`
	DisplayNumber string `json:"displayNumber,omitempty"`
	VerifyToken   string `json:"verifyToken,omitempty"`
	AppSecret     string `json:"appSecret,omitempty"`

	// email_resend
	APIKey    string `json:"apiKey,omitempty"`
	FromEmail string `json:"fromEmail,omitempty"`
	FromName  string `json:"fromName,omitempty"`

	// telegram_bot
	BotToken string `json:"botToken,omitempty"`

	// slack_webhook / discord_webhook
	WebhookURL string `json:"webhookUrl,omitempty"`
}

// ChannelCreated is a created integration, possibly carrying setup
// hints (webhook URL to register, Meta verify token, next step).
type ChannelCreated struct {
	ChannelIntegration
	WebhookURL  string `json:"webhookUrl,omitempty"`
	VerifyToken string `json:"verifyToken,omitempty"`
	Note        string `json:"note,omitempty"`
}

// Create calls POST /api/v1/channels — connect a provider.
func (r *ChannelsResource) Create(ctx context.Context, input ChannelCreateInput) (*ChannelCreated, error) {
	var out ChannelCreated
	if err := r.c.do(ctx, "POST", "/api/v1/channels", nil, input, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete calls DELETE /api/v1/channels/:id.
func (r *ChannelsResource) Delete(ctx context.Context, id string) error {
	path := "/api/v1/channels/" + url.PathEscape(id)
	return r.c.do(ctx, "DELETE", path, nil, nil, false, nil)
}

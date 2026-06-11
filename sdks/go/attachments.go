package suppuo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
)

// AttachmentsResource handles ticket-message attachments — staging
// uploads + downloads (Bearer auth). Staged attachments are bound to a
// message via TicketReplyInput.AttachmentIDs; unbound rows expire
// after 1 hour.
type AttachmentsResource struct {
	c *Client
}

// AttachmentMeta is the display-safe attachment metadata (bytes are
// never inlined in JSON payloads).
type AttachmentMeta struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	Size        int    `json:"size"`
	CreatedAt   string `json:"createdAt"`
}

// AttachmentUploadInput is the payload for Attachments.Upload.
type AttachmentUploadInput struct {
	Data        []byte
	Filename    string
	ContentType string
}

// Upload calls POST /api/v1/attachments — stage an upload (raw bytes +
// X-Filename header; 8MB max). Bind the returned ID to a reply via
// Tickets.Reply with AttachmentIDs.
func (r *AttachmentsResource) Upload(ctx context.Context, input AttachmentUploadInput) (*AttachmentMeta, error) {
	c := r.c
	if c.token == "" {
		return nil, &Error{
			Status:  0,
			Code:    "AUTH_REQUIRED",
			Message: "no token configured: set Config.Token or SUPPUO_TOKEN",
		}
	}
	req, err := http.NewRequestWithContext(
		ctx, "POST", c.baseURL+"/api/v1/attachments", bytes.NewReader(input.Data),
	)
	if err != nil {
		return nil, &Error{Status: 0, Code: "REQUEST_BUILD_FAILED", Message: err.Error()}
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", input.ContentType)
	req.Header.Set("X-Filename", url.QueryEscape(input.Filename))
	req.Header.Set("Authorization", "Bearer "+c.token)

	res, err := c.httpc.Do(req)
	if err != nil {
		return nil, &Error{Status: 0, Code: "NETWORK_ERROR", Message: err.Error()}
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)

	var env envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, &Error{
			Status:  res.StatusCode,
			Code:    "INVALID_RESPONSE",
			Message: fmt.Sprintf("non-JSON response (HTTP %d)", res.StatusCode),
		}
	}
	if apiErr := envelopeToError(res.StatusCode, &env); apiErr != nil {
		return nil, apiErr
	}
	var out AttachmentMeta
	if err := json.Unmarshal(env.Data, &out); err != nil {
		return nil, &Error{Status: res.StatusCode, Code: "DECODE_FAILED", Message: err.Error()}
	}
	return &out, nil
}

// AttachmentDownload is the downloaded bytes plus metadata recovered
// from the response headers.
type AttachmentDownload struct {
	Data        []byte
	ContentType string
	Filename    string
}

// Download calls GET /api/v1/attachments/:id — account-scoped binary
// download.
func (r *AttachmentsResource) Download(ctx context.Context, id string) (*AttachmentDownload, error) {
	c := r.c
	if c.token == "" {
		return nil, &Error{
			Status:  0,
			Code:    "AUTH_REQUIRED",
			Message: "no token configured: set Config.Token or SUPPUO_TOKEN",
		}
	}
	req, err := http.NewRequestWithContext(
		ctx, "GET", c.baseURL+"/api/v1/attachments/"+url.PathEscape(id), nil,
	)
	if err != nil {
		return nil, &Error{Status: 0, Code: "REQUEST_BUILD_FAILED", Message: err.Error()}
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	res, err := c.httpc.Do(req)
	if err != nil {
		return nil, &Error{Status: 0, Code: "NETWORK_ERROR", Message: err.Error()}
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)

	if res.StatusCode >= 400 {
		// Error responses still ride the JSON envelope on this route.
		var env envelope
		if err := json.Unmarshal(raw, &env); err == nil {
			if apiErr := envelopeToError(res.StatusCode, &env); apiErr != nil {
				return nil, apiErr
			}
		}
		return nil, &Error{
			Status:  res.StatusCode,
			Code:    "UNKNOWN",
			Message: fmt.Sprintf("HTTP %d", res.StatusCode),
		}
	}

	filename := id
	if disposition := res.Header.Get("Content-Disposition"); disposition != "" {
		if _, params, err := mime.ParseMediaType(disposition); err == nil {
			if name := params["filename"]; name != "" {
				filename = name
			}
		}
	}
	contentType := res.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return &AttachmentDownload{Data: raw, ContentType: contentType, Filename: filename}, nil
}

// envelopeToError maps an error envelope (or a non-2xx status) to
// *Error; nil when the response is a success.
func envelopeToError(status int, env *envelope) *Error {
	if status < 400 && env.Error == nil {
		return nil
	}
	code := "UNKNOWN"
	message := fmt.Sprintf("HTTP %d", status)
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
	requestID := ""
	if env.Meta != nil {
		requestID = env.Meta.RequestID
	}
	return &Error{Status: status, Code: code, Message: message, RequestID: requestID, Param: param}
}

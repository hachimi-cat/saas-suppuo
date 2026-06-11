package suppuo

import "context"

// SettingsResource is the workspace settings surface (Bearer auth).
type SettingsResource struct {
	c *Client
}

// BusinessHoursDay is one weekday's window; a nil entry in
// BusinessHours.Days means closed that day.
type BusinessHoursDay struct {
	Dow   int    `json:"dow"`  // 0-6
	Open  string `json:"open"` // HH:mm
	Close string `json:"close"`
}

// BusinessHours configures the workspace's open hours.
type BusinessHours struct {
	// TZ is the IANA timezone, e.g. "Asia/Jakarta".
	TZ string `json:"tz"`
	// Days has exactly 7 entries (dow 0-6); nil = closed that day.
	Days []*BusinessHoursDay `json:"days"`
}

// AutomationSettings is the GET/PUT /api/v1/settings/automation shape.
type AutomationSettings struct {
	BusinessHours       *BusinessHours `json:"businessHours"`
	AutoResponseEnabled bool           `json:"autoResponseEnabled"`
	AutoResponseInside  *string        `json:"autoResponseInside"`
	AutoResponseOutside *string        `json:"autoResponseOutside"`
	// HideBranding hides "Powered by Suppuo" in requester-facing
	// surfaces.
	HideBranding bool `json:"hideBranding"`
}

// AutomationSettingsPatch is a partial update for
// Settings.PutAutomation. Nil pointer fields are omitted (left alone
// server-side). To CLEAR businessHours or a template, send the field
// as an explicit JSON null via a custom payload — or simply overwrite
// with new values.
type AutomationSettingsPatch struct {
	BusinessHours       *BusinessHours `json:"businessHours,omitempty"`
	AutoResponseEnabled *bool          `json:"autoResponseEnabled,omitempty"`
	AutoResponseInside  *string        `json:"autoResponseInside,omitempty"`
	AutoResponseOutside *string        `json:"autoResponseOutside,omitempty"`
	HideBranding        *bool          `json:"hideBranding,omitempty"`
}

// GetAutomation calls GET /api/v1/settings/automation — business hours
// + the inside/outside auto-response templates + hideBranding.
func (r *SettingsResource) GetAutomation(ctx context.Context) (*AutomationSettings, error) {
	var out AutomationSettings
	if err := r.c.do(ctx, "GET", "/api/v1/settings/automation", nil, nil, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// PutAutomation calls PUT /api/v1/settings/automation — partial
// update; omitted fields are left alone.
func (r *SettingsResource) PutAutomation(ctx context.Context, patch AutomationSettingsPatch) (*AutomationSettings, error) {
	var out AutomationSettings
	if err := r.c.do(ctx, "PUT", "/api/v1/settings/automation", nil, patch, false, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

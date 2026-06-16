-- Customer-facing branding for the help center + hosted portal.
ALTER TABLE "account_settings"
    ADD COLUMN "brandName"    TEXT,
    ADD COLUMN "brandLogoUrl" TEXT,
    ADD COLUMN "accentColor"  TEXT,
    ADD COLUMN "brandColor"   TEXT;

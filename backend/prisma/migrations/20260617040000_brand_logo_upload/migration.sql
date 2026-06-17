-- Uploadable per-workspace brand logo (stored as bytes, served at
-- /public/help/<acc>/logo). Mirrors the agent-avatar storage pattern.
ALTER TABLE "account_settings"
    ADD COLUMN "brandLogoData" BYTEA,
    ADD COLUMN "brandLogoType" TEXT;

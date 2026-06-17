-- Readable, editable URL handle for the help center + portal.
ALTER TABLE "account_settings" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "account_settings_slug_key" ON "account_settings"("slug");

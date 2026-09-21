-- Optional live-chat foreground override. NULL keeps automatic
-- black/white contrast against the workspace accent color.
ALTER TABLE "account_settings" ADD COLUMN "widgetTextColor" TEXT;

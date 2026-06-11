-- Platform-WhatsApp metering removed: the shared number is dead (Meta
-- account permanently blocked) and WhatsApp is BYO-only, so the
-- counters had nothing to count. Table held zero rows on prod+staging.
DROP TABLE IF EXISTS "channel_usage";

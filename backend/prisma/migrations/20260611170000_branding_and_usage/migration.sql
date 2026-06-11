-- Branding toggle (paid-tier perk; unenforced during early access)
ALTER TABLE "account_settings" ADD COLUMN "hideBranding" BOOLEAN NOT NULL DEFAULT false;

-- Monthly usage counters for platform-WhatsApp metering
CREATE TABLE "channel_usage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_usage_accountId_period_metric_key"
    ON "channel_usage"("accountId", "period", "metric");

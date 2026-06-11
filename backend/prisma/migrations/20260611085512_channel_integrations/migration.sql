-- BYO channel integrations (ripllo ChannelIntegration pattern).
CREATE TABLE "channel_integrations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "credentials" TEXT NOT NULL DEFAULT '',
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_integrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "channel_integrations_accountId_provider_externalId_key" ON "channel_integrations"("accountId", "provider", "externalId");
CREATE INDEX "channel_integrations_accountId_status_idx" ON "channel_integrations"("accountId", "status");
CREATE INDEX "channel_integrations_provider_externalId_idx" ON "channel_integrations"("provider", "externalId");

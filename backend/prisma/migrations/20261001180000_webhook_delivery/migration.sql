-- Webhook delivery (2026-10-01).
--
-- Deliveries to a workspace's webhook subscriptions used to be one
-- fire-and-forget POST per event: a failure was logged and lost. They are
-- now queued per (subscription, event), sent by services/webhook-delivery.ts,
-- retried 1 min, 5 min, 25 min, 2 h and 12 h later and logged attempt by
-- attempt; a subscription that keeps failing is switched off.

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "WebhookAttemptStatus" AS ENUM ('succeeded', 'failed');

-- AlterTable
ALTER TABLE "webhook_subscriptions"
  ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failingSince"        TIMESTAMP(3),
  ADD COLUMN "disabledAt"          TIMESTAMP(3),
  ADD COLUMN "disabledReason"      TEXT;

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "responseCode" INTEGER,
    "lastError" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery_attempts" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "WebhookAttemptStatus" NOT NULL,
    "responseCode" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "error" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_subscriptionId_eventId_key" ON "webhook_deliveries"("subscriptionId", "eventId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_nextRetryAt_idx" ON "webhook_deliveries"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "webhook_deliveries_accountId_createdAt_idx" ON "webhook_deliveries"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_attempts_deliveryId_attemptNumber_key" ON "webhook_delivery_attempts"("deliveryId", "attemptNumber");

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_accountId_attemptedAt_idx" ON "webhook_delivery_attempts"("accountId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "webhook_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

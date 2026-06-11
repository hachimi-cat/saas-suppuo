-- Feature wave: CSAT + automation. Additive only — no existing rows
-- touched.

-- CreateTable: post-resolve satisfaction ratings (one per ticket).
CREATE TABLE "csat_responses" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csat_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "csat_responses_ticketId_key" ON "csat_responses"("ticketId");

-- CreateIndex
CREATE INDEX "csat_responses_accountId_createdAt_idx" ON "csat_responses"("accountId", "createdAt");

-- CreateTable: per-workspace automation settings (auto-response +
-- business hours).
CREATE TABLE "account_settings" (
    "accountId" TEXT NOT NULL,
    "businessHours" JSONB,
    "autoResponseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoResponseInside" TEXT,
    "autoResponseOutside" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_settings_pkey" PRIMARY KEY ("accountId")
);

-- AlterTable: send-once guard for the CSAT survey email.
ALTER TABLE "tickets" ADD COLUMN "csatSentAt" TIMESTAMP(3);

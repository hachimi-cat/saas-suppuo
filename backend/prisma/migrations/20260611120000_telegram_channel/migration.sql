-- Channel wave 2: telegram identity — channel-native requester ids
-- (Telegram chat id) for non-phone channels. Additive only.
ALTER TABLE "tickets" ADD COLUMN "requesterExternalId" TEXT;
CREATE INDEX "tickets_accountId_requesterExternalId_idx" ON "tickets"("accountId", "requesterExternalId");

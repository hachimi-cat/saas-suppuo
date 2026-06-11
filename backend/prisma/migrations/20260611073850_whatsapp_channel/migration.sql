-- WhatsApp channel: phone-identified requesters.
ALTER TABLE "tickets" ALTER COLUMN "requesterEmail" DROP NOT NULL;
ALTER TABLE "tickets" ADD COLUMN "requesterPhone" TEXT;
CREATE INDEX "tickets_accountId_requesterPhone_idx" ON "tickets"("accountId", "requesterPhone");

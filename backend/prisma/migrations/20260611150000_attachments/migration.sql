-- Feature wave: attachments — files on ticket messages. v1 stores the
-- bytes inline in Postgres (SME volume; 8MB/file, 5 files/message).
-- Rows are staged with "messageId" NULL and bound in the
-- message-create transaction. Additive only.
-- TODO: DO Spaces when volume demands
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "messageId" TEXT,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");
CREATE INDEX "attachments_accountId_idx" ON "attachments"("accountId");

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "ticket_messages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

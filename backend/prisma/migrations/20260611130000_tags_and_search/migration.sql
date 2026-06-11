-- Inbox power: ticket tags + full-text-ish search support.
-- Additive only — no destructive changes.

-- Free-form labels on tickets (normalized app-side).
ALTER TABLE "tickets" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Trigram index so ILIKE '%q%' on subject stays fast as inboxes grow.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ix_tickets_subject_trgm"
  ON "tickets" USING GIN ("subject" gin_trgm_ops);

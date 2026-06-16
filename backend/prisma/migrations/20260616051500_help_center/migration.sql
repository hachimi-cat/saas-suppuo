-- Help center: a Suppuo-managed knowledge base (FAQ + articles) plus a
-- public contact profile and optional deep-links to the product's own
-- /docs and /contact pages. Hand-written additive migration.

-- AlterTable: account_settings gains the public contact profile + links.
ALTER TABLE "account_settings"
    ADD COLUMN "contactEmail"   TEXT,
    ADD COLUMN "contactPhone"   TEXT,
    ADD COLUMN "contactAddress" TEXT,
    ADD COLUMN "docsUrl"        TEXT,
    ADD COLUMN "contactUrl"     TEXT,
    ADD COLUMN "helpIntro"      TEXT;

-- CreateTable: help_articles (FAQ + articles).
CREATE TABLE "help_articles" (
    "id"        TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind"      TEXT NOT NULL DEFAULT 'faq',
    "slug"      TEXT,
    "category"  TEXT,
    "title"     TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'draft',
    "position"  INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- Unique slug per account (NULLs are distinct in Postgres, so FAQ rows
-- with a null slug never collide).
CREATE UNIQUE INDEX "help_articles_accountId_slug_key" ON "help_articles"("accountId", "slug");
CREATE INDEX "help_articles_accountId_kind_status_position_idx" ON "help_articles"("accountId", "kind", "status", "position");
CREATE INDEX "help_articles_accountId_status_idx" ON "help_articles"("accountId", "status");

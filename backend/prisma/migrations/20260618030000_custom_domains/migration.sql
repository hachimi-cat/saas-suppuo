-- Custom domains mapped to workspaces (help center + portal).
CREATE TABLE "custom_domains" (
    "id"                TEXT NOT NULL,
    "accountId"         TEXT NOT NULL,
    "domain"            TEXT NOT NULL,
    "status"            TEXT NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT NOT NULL,
    "sslProvisioned"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "custom_domains_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "custom_domains_domain_key" ON "custom_domains"("domain");
CREATE INDEX "custom_domains_accountId_idx" ON "custom_domains"("accountId");
CREATE INDEX "custom_domains_domain_idx" ON "custom_domains"("domain");
CREATE INDEX "custom_domains_status_idx" ON "custom_domains"("status");

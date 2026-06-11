-- Agent profiles (avatar; name lives in Huudis).
-- Hand-written additive migration — CREATE TABLE only.

-- CreateTable
CREATE TABLE "agent_profiles" (
    "sub" TEXT NOT NULL,
    "avatar" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_profiles_pkey" PRIMARY KEY ("sub")
);

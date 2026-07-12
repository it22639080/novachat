CREATE TYPE "BillingStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED');

CREATE TYPE "UsageEventType" AS ENUM ('AI_REPLY', 'AI_INPUT_TOKEN', 'AI_OUTPUT_TOKEN', 'WHATSAPP_MESSAGE', 'CREDIT_TOPUP', 'LIMIT_RESET');

CREATE TYPE "CreditTopUpType" AS ENUM ('AI_REPLY', 'WHATSAPP_MESSAGE');

CREATE TABLE "TenantUsageLimit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planName" TEXT NOT NULL DEFAULT 'Starter',
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'TRIALING',
    "aiMonthlyReplyLimit" INTEGER NOT NULL DEFAULT 100,
    "whatsappMonthlyMessageLimit" INTEGER NOT NULL DEFAULT 1000,
    "currentAiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "dailyAiCostLimit" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "monthlyAiCostLimit" DECIMAL(12,4) NOT NULL DEFAULT 20,
    "billingCycleStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingCycleEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "TenantUsageLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantUsageCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aiRepliesUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "aiInputTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "aiOutputTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "whatsappMessagesUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "aiCostUsedToday" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "aiCostUsedThisMonth" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "aiDisabledDueToLimit" BOOLEAN NOT NULL DEFAULT false,
    "whatsappDisabledDueToLimit" BOOLEAN NOT NULL DEFAULT false,
    "lastUsageResetAt" TIMESTAMP(3),
    "dailyCostResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "TenantUsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantCreditBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "extraAiReplyCredits" INTEGER NOT NULL DEFAULT 0,
    "extraWhatsappMessageCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "TenantCreditBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditTopUp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "CreditTopUpType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CreditTopUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "UsageEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costEstimate" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantUsageLimit_tenantId_key" ON "TenantUsageLimit"("tenantId");
CREATE INDEX "TenantUsageLimit_tenantId_idx" ON "TenantUsageLimit"("tenantId");
CREATE INDEX "TenantUsageLimit_billingStatus_idx" ON "TenantUsageLimit"("billingStatus");
CREATE INDEX "TenantUsageLimit_createdAt_idx" ON "TenantUsageLimit"("createdAt");
CREATE INDEX "TenantUsageLimit_deletedAt_idx" ON "TenantUsageLimit"("deletedAt");

CREATE UNIQUE INDEX "TenantUsageCounter_tenantId_key" ON "TenantUsageCounter"("tenantId");
CREATE INDEX "TenantUsageCounter_tenantId_idx" ON "TenantUsageCounter"("tenantId");
CREATE INDEX "TenantUsageCounter_aiDisabledDueToLimit_idx" ON "TenantUsageCounter"("aiDisabledDueToLimit");
CREATE INDEX "TenantUsageCounter_whatsappDisabledDueToLimit_idx" ON "TenantUsageCounter"("whatsappDisabledDueToLimit");
CREATE INDEX "TenantUsageCounter_createdAt_idx" ON "TenantUsageCounter"("createdAt");
CREATE INDEX "TenantUsageCounter_deletedAt_idx" ON "TenantUsageCounter"("deletedAt");

CREATE UNIQUE INDEX "TenantCreditBalance_tenantId_key" ON "TenantCreditBalance"("tenantId");
CREATE INDEX "TenantCreditBalance_tenantId_idx" ON "TenantCreditBalance"("tenantId");
CREATE INDEX "TenantCreditBalance_createdAt_idx" ON "TenantCreditBalance"("createdAt");
CREATE INDEX "TenantCreditBalance_deletedAt_idx" ON "TenantCreditBalance"("deletedAt");

CREATE INDEX "CreditTopUp_tenantId_idx" ON "CreditTopUp"("tenantId");
CREATE INDEX "CreditTopUp_tenantId_type_idx" ON "CreditTopUp"("tenantId", "type");
CREATE INDEX "CreditTopUp_actorUserId_idx" ON "CreditTopUp"("actorUserId");
CREATE INDEX "CreditTopUp_createdAt_idx" ON "CreditTopUp"("createdAt");
CREATE INDEX "CreditTopUp_deletedAt_idx" ON "CreditTopUp"("deletedAt");

CREATE INDEX "UsageEvent_tenantId_idx" ON "UsageEvent"("tenantId");
CREATE INDEX "UsageEvent_tenantId_type_idx" ON "UsageEvent"("tenantId", "type");
CREATE INDEX "UsageEvent_tenantId_createdAt_idx" ON "UsageEvent"("tenantId", "createdAt");
CREATE INDEX "UsageEvent_type_idx" ON "UsageEvent"("type");
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

ALTER TABLE "TenantUsageLimit" ADD CONSTRAINT "TenantUsageLimit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantUsageCounter" ADD CONSTRAINT "TenantUsageCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantCreditBalance" ADD CONSTRAINT "TenantCreditBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTopUp" ADD CONSTRAINT "CreditTopUp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditTopUp" ADD CONSTRAINT "CreditTopUp_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "TenantUsageLimit" ("id", "tenantId", "currentAiModel", "billingCycleStart", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'gpt-4o-mini', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant"
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "TenantUsageCounter" ("id", "tenantId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant"
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "TenantCreditBalance" ("id", "tenantId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant"
ON CONFLICT ("tenantId") DO NOTHING;

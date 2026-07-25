ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'PENDING_EMAIL_VERIFICATION';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'PENDING_ADMIN_APPROVAL';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIAL';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "UsageEventType" ADD VALUE IF NOT EXISTS 'WHATSAPP_INBOUND';
ALTER TYPE "UsageEventType" ADD VALUE IF NOT EXISTS 'WHATSAPP_OUTBOUND';
ALTER TYPE "UsageEventType" ADD VALUE IF NOT EXISTS 'KNOWLEDGE_STORAGE';

DO $$ BEGIN
  CREATE TYPE "UsageRecordType" AS ENUM (
    'AI_REPLY',
    'AI_INPUT_TOKEN',
    'AI_OUTPUT_TOKEN',
    'WHATSAPP_INBOUND',
    'WHATSAPP_OUTBOUND',
    'KNOWLEDGE_STORAGE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reactivatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reactivatedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalStatusChangedAt" TIMESTAMP(3);

ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "monthlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "yearlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiReplyLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiInputTokenLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiOutputTokenLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "whatsappMessageLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "agentLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "whatsappAccountLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "knowledgeBaseStorageLimitBytes" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "featuresJson" JSONB,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "Plan"
SET
  "monthlyPrice" = "priceMonthly",
  "yearlyPrice" = CASE WHEN "yearlyPrice" = 0 THEN "priceMonthly" * 10 ELSE "yearlyPrice" END,
  "aiReplyLimit" = COALESCE(("limits"->>'aiMonthlyReplies')::int, "aiReplyLimit"),
  "whatsappMessageLimit" = COALESCE(("limits"->>'monthlyConversations')::int, "whatsappMessageLimit"),
  "agentLimit" = COALESCE(("limits"->>'teamMembers')::int, "agentLimit"),
  "whatsappAccountLimit" = COALESCE(("limits"->>'whatsappAccounts')::int, "whatsappAccountLimit"),
  "knowledgeBaseStorageLimitBytes" = COALESCE((("limits"->>'knowledgeBaseStorageMb')::bigint * 1024 * 1024), "knowledgeBaseStorageLimitBytes"),
  "featuresJson" = COALESCE("featuresJson", "limits")
WHERE "deletedAt" IS NULL;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEndAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Subscription"
SET
  "startAt" = COALESCE("startAt", "currentPeriodStart"),
  "endAt" = COALESCE("endAt", "currentPeriodEnd"),
  "trialEndAt" = COALESCE("trialEndAt", "trialEndsAt");

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Invoice"
SET "invoiceNumber" = COALESCE("invoiceNumber", "number");

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "method" TEXT,
  ADD COLUMN IF NOT EXISTS "transactionReference" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "UsageRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "conversationId" TEXT,
  "type" "UsageRecordType" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "model" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCost" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "referenceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MonthlyUsage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "aiRepliesUsed" INTEGER NOT NULL DEFAULT 0,
  "aiInputTokensUsed" INTEGER NOT NULL DEFAULT 0,
  "aiOutputTokensUsed" INTEGER NOT NULL DEFAULT 0,
  "whatsappMessagesUsed" INTEGER NOT NULL DEFAULT 0,
  "knowledgeStorageUsedBytes" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentProof" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentId" TEXT,
  "uploadedById" TEXT,
  "storageUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyUsage_tenantId_periodStart_periodEnd_key" ON "MonthlyUsage"("tenantId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "MonthlyUsage_tenantId_idx" ON "MonthlyUsage"("tenantId");
CREATE INDEX IF NOT EXISTS "MonthlyUsage_tenantId_periodStart_idx" ON "MonthlyUsage"("tenantId", "periodStart");
CREATE INDEX IF NOT EXISTS "MonthlyUsage_periodEnd_idx" ON "MonthlyUsage"("periodEnd");

CREATE INDEX IF NOT EXISTS "UsageRecord_tenantId_idx" ON "UsageRecord"("tenantId");
CREATE INDEX IF NOT EXISTS "UsageRecord_tenantId_type_idx" ON "UsageRecord"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "UsageRecord_tenantId_createdAt_idx" ON "UsageRecord"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageRecord_userId_idx" ON "UsageRecord"("userId");
CREATE INDEX IF NOT EXISTS "UsageRecord_conversationId_idx" ON "UsageRecord"("conversationId");
CREATE INDEX IF NOT EXISTS "UsageRecord_referenceId_idx" ON "UsageRecord"("referenceId");
CREATE INDEX IF NOT EXISTS "UsageRecord_createdAt_idx" ON "UsageRecord"("createdAt");

CREATE INDEX IF NOT EXISTS "PaymentProof_tenantId_idx" ON "PaymentProof"("tenantId");
CREATE INDEX IF NOT EXISTS "PaymentProof_tenantId_status_idx" ON "PaymentProof"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PaymentProof_invoiceId_idx" ON "PaymentProof"("invoiceId");
CREATE INDEX IF NOT EXISTS "PaymentProof_paymentId_idx" ON "PaymentProof"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentProof_uploadedById_idx" ON "PaymentProof"("uploadedById");
CREATE INDEX IF NOT EXISTS "PaymentProof_createdAt_idx" ON "PaymentProof"("createdAt");
CREATE INDEX IF NOT EXISTS "PaymentProof_deletedAt_idx" ON "PaymentProof"("deletedAt");

DO $$ BEGIN
  ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MonthlyUsage" ADD CONSTRAINT "MonthlyUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

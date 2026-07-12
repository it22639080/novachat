CREATE TYPE "WhatsAppOnboardingMethod" AS ENUM ('MANUAL', 'EMBEDDED_SIGNUP');
CREATE TYPE "MetaConnectionLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');
CREATE TYPE "WhatsAppWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

ALTER TABLE "WhatsAppAccount"
  ADD COLUMN "onboardingMethod" "WhatsAppOnboardingMethod" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "metaBusinessId" TEXT,
  ADD COLUMN "wabaId" TEXT,
  ADD COLUMN "verifiedName" TEXT,
  ADD COLUMN "qualityRating" TEXT,
  ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "connectedAt" TIMESTAMP(3),
  ADD COLUMN "disconnectedAt" TIMESTAMP(3),
  ADD COLUMN "lastHealthCheckAt" TIMESTAMP(3),
  ADD COLUMN "lastWebhookAt" TIMESTAMP(3),
  ADD COLUMN "setupErrors" JSONB,
  ADD COLUMN "rawOnboardingMetadata" JSONB;

CREATE TABLE "MetaConnectionLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "whatsappAccountId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" "MetaConnectionLogStatus" NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaConnectionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppWebhookLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "whatsappAccountId" TEXT,
  "phoneNumberId" TEXT,
  "status" "WhatsAppWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "errorMessage" TEXT,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppWebhookLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WhatsAppAccount_tenantId_onboardingMethod_idx" ON "WhatsAppAccount"("tenantId", "onboardingMethod");
CREATE INDEX "WhatsAppAccount_phoneNumberId_idx" ON "WhatsAppAccount"("phoneNumberId");
CREATE INDEX "WhatsAppAccount_wabaId_idx" ON "WhatsAppAccount"("wabaId");

CREATE INDEX "MetaConnectionLog_tenantId_idx" ON "MetaConnectionLog"("tenantId");
CREATE INDEX "MetaConnectionLog_tenantId_eventType_idx" ON "MetaConnectionLog"("tenantId", "eventType");
CREATE INDEX "MetaConnectionLog_tenantId_status_idx" ON "MetaConnectionLog"("tenantId", "status");
CREATE INDEX "MetaConnectionLog_whatsappAccountId_idx" ON "MetaConnectionLog"("whatsappAccountId");
CREATE INDEX "MetaConnectionLog_createdAt_idx" ON "MetaConnectionLog"("createdAt");

CREATE INDEX "WhatsAppWebhookLog_tenantId_idx" ON "WhatsAppWebhookLog"("tenantId");
CREATE INDEX "WhatsAppWebhookLog_phoneNumberId_idx" ON "WhatsAppWebhookLog"("phoneNumberId");
CREATE INDEX "WhatsAppWebhookLog_whatsappAccountId_idx" ON "WhatsAppWebhookLog"("whatsappAccountId");
CREATE INDEX "WhatsAppWebhookLog_status_idx" ON "WhatsAppWebhookLog"("status");
CREATE INDEX "WhatsAppWebhookLog_createdAt_idx" ON "WhatsAppWebhookLog"("createdAt");

ALTER TABLE "MetaConnectionLog"
  ADD CONSTRAINT "MetaConnectionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MetaConnectionLog_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppWebhookLog"
  ADD CONSTRAINT "WhatsAppWebhookLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WhatsAppWebhookLog_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

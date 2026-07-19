-- Phase: WhatsApp Web experimental linked-device provider.
-- QR values are transient realtime events and are intentionally not persisted.

ALTER TYPE "WhatsAppOnboardingMethod" ADD VALUE IF NOT EXISTS 'WHATSAPP_WEB_EXPERIMENTAL';

CREATE TYPE "WhatsAppProviderType" AS ENUM ('META_CLOUD', 'WHATSAPP_WEB_EXPERIMENTAL');
CREATE TYPE "WhatsAppWebSessionStatus" AS ENUM (
  'DISCONNECTED',
  'INITIALIZING',
  'QR_REQUIRED',
  'CONNECTING',
  'CONNECTED',
  'RECONNECTING',
  'SESSION_EXPIRED',
  'AUTH_FAILURE',
  'ERROR'
);
CREATE TYPE "WhatsAppOutboundOrigin" AS ENUM ('AI', 'AGENT', 'SYSTEM');
CREATE TYPE "WhatsAppOutboundStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'BLOCKED');

CREATE TABLE "WhatsAppWebSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "whatsappAccountId" TEXT,
  "providerType" "WhatsAppProviderType" NOT NULL DEFAULT 'WHATSAPP_WEB_EXPERIMENTAL',
  "status" "WhatsAppWebSessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "displayNumber" TEXT,
  "displayName" TEXT,
  "encryptedSessionState" TEXT,
  "sessionKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "connectedInstanceId" TEXT,
  "explicitDisconnect" BOOLEAN NOT NULL DEFAULT false,
  "lastConnectedAt" TIMESTAMP(3),
  "lastDisconnectedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "reconnectAttempts" INTEGER NOT NULL DEFAULT 0,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "WhatsAppWebSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppOutboundJob" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "providerType" "WhatsAppProviderType" NOT NULL,
  "connectionId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "incomingMessageId" TEXT,
  "internalMessageId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "origin" "WhatsAppOutboundOrigin" NOT NULL,
  "status" "WhatsAppOutboundStatus" NOT NULL DEFAULT 'QUEUED',
  "externalMessageId" TEXT,
  "failureReason" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "WhatsAppOutboundJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppWebSession_whatsappAccountId_key" ON "WhatsAppWebSession"("whatsappAccountId");
CREATE UNIQUE INDEX "WhatsAppWebSession_one_active_per_tenant" ON "WhatsAppWebSession"("tenantId") WHERE "deletedAt" IS NULL;
CREATE INDEX "WhatsAppWebSession_tenantId_idx" ON "WhatsAppWebSession"("tenantId");
CREATE INDEX "WhatsAppWebSession_tenantId_status_idx" ON "WhatsAppWebSession"("tenantId", "status");
CREATE INDEX "WhatsAppWebSession_providerType_idx" ON "WhatsAppWebSession"("providerType");
CREATE INDEX "WhatsAppWebSession_status_idx" ON "WhatsAppWebSession"("status");
CREATE INDEX "WhatsAppWebSession_lastHeartbeatAt_idx" ON "WhatsAppWebSession"("lastHeartbeatAt");
CREATE INDEX "WhatsAppWebSession_createdAt_idx" ON "WhatsAppWebSession"("createdAt");
CREATE INDEX "WhatsAppWebSession_deletedAt_idx" ON "WhatsAppWebSession"("deletedAt");

CREATE UNIQUE INDEX "WhatsAppOutboundJob_tenantId_internalMessageId_key" ON "WhatsAppOutboundJob"("tenantId", "internalMessageId");
CREATE INDEX "WhatsAppOutboundJob_tenantId_idx" ON "WhatsAppOutboundJob"("tenantId");
CREATE INDEX "WhatsAppOutboundJob_tenantId_providerType_idx" ON "WhatsAppOutboundJob"("tenantId", "providerType");
CREATE INDEX "WhatsAppOutboundJob_tenantId_status_idx" ON "WhatsAppOutboundJob"("tenantId", "status");
CREATE INDEX "WhatsAppOutboundJob_connectionId_idx" ON "WhatsAppOutboundJob"("connectionId");
CREATE INDEX "WhatsAppOutboundJob_conversationId_idx" ON "WhatsAppOutboundJob"("conversationId");
CREATE INDEX "WhatsAppOutboundJob_incomingMessageId_idx" ON "WhatsAppOutboundJob"("incomingMessageId");
CREATE INDEX "WhatsAppOutboundJob_internalMessageId_idx" ON "WhatsAppOutboundJob"("internalMessageId");
CREATE INDEX "WhatsAppOutboundJob_externalMessageId_idx" ON "WhatsAppOutboundJob"("externalMessageId");
CREATE INDEX "WhatsAppOutboundJob_createdAt_idx" ON "WhatsAppOutboundJob"("createdAt");
CREATE INDEX "WhatsAppOutboundJob_deletedAt_idx" ON "WhatsAppOutboundJob"("deletedAt");

ALTER TABLE "WhatsAppWebSession"
  ADD CONSTRAINT "WhatsAppWebSession_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WhatsAppWebSession"
  ADD CONSTRAINT "WhatsAppWebSession_whatsappAccountId_fkey"
  FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppOutboundJob"
  ADD CONSTRAINT "WhatsAppOutboundJob_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

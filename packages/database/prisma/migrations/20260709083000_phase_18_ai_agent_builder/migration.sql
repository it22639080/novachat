CREATE TYPE "AiAgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "AiAgent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "templateKey" TEXT,
  "status" "AiAgentStatus" NOT NULL DEFAULT 'DRAFT',
  "provider" "AiProvider" NOT NULL DEFAULT 'OPENAI',
  "modelName" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.2,
  "personality" TEXT NOT NULL DEFAULT 'helpful',
  "tone" TEXT NOT NULL DEFAULT 'professional',
  "supportedLanguages" TEXT[] NOT NULL DEFAULT ARRAY['English']::TEXT[],
  "systemPrompt" TEXT NOT NULL,
  "customPrompt" TEXT,
  "toolPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedActions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "handoverRules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "knowledgeDocumentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "assignedWhatsappAccountId" TEXT,
  "assignedChatbotId" TEXT,
  "activeVersion" INTEGER NOT NULL DEFAULT 1,
  "lastTestedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "AiAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "aiAgentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changelog" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "AiAgentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAgentVersion_aiAgentId_version_key" ON "AiAgentVersion"("aiAgentId", "version");

CREATE INDEX "AiAgent_tenantId_idx" ON "AiAgent"("tenantId");
CREATE INDEX "AiAgent_tenantId_status_idx" ON "AiAgent"("tenantId", "status");
CREATE INDEX "AiAgent_tenantId_assignedWhatsappAccountId_idx" ON "AiAgent"("tenantId", "assignedWhatsappAccountId");
CREATE INDEX "AiAgent_tenantId_assignedChatbotId_idx" ON "AiAgent"("tenantId", "assignedChatbotId");
CREATE INDEX "AiAgent_tenantId_templateKey_idx" ON "AiAgent"("tenantId", "templateKey");
CREATE INDEX "AiAgent_createdAt_idx" ON "AiAgent"("createdAt");
CREATE INDEX "AiAgent_deletedAt_idx" ON "AiAgent"("deletedAt");

CREATE INDEX "AiAgentVersion_tenantId_idx" ON "AiAgentVersion"("tenantId");
CREATE INDEX "AiAgentVersion_tenantId_aiAgentId_idx" ON "AiAgentVersion"("tenantId", "aiAgentId");
CREATE INDEX "AiAgentVersion_tenantId_version_idx" ON "AiAgentVersion"("tenantId", "version");
CREATE INDEX "AiAgentVersion_createdByUserId_idx" ON "AiAgentVersion"("createdByUserId");
CREATE INDEX "AiAgentVersion_createdAt_idx" ON "AiAgentVersion"("createdAt");
CREATE INDEX "AiAgentVersion_deletedAt_idx" ON "AiAgentVersion"("deletedAt");

ALTER TABLE "AiAgent"
  ADD CONSTRAINT "AiAgent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AiAgent_assignedWhatsappAccountId_fkey" FOREIGN KEY ("assignedWhatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AiAgent_assignedChatbotId_fkey" FOREIGN KEY ("assignedChatbotId") REFERENCES "Chatbot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiAgentVersion"
  ADD CONSTRAINT "AiAgentVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AiAgentVersion_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AiAgentVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

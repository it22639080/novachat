ALTER TABLE "Conversation" ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Conversation" ADD COLUMN "humanHandover" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiLog" ADD COLUMN "metadata" JSONB;

CREATE INDEX "Conversation_tenantId_aiEnabled_idx" ON "Conversation"("tenantId", "aiEnabled");
CREATE INDEX "Conversation_tenantId_humanHandover_idx" ON "Conversation"("tenantId", "humanHandover");

CREATE TABLE "TenantAiSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "AiProvider" NOT NULL DEFAULT 'OPENAI',
    "modelName" TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
    "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.2,
    "businessName" TEXT,
    "businessDescription" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'friendly',
    "supportedLanguages" TEXT[] NOT NULL DEFAULT ARRAY['English']::TEXT[],
    "openingHours" JSONB,
    "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "policies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "fallbackMessage" TEXT NOT NULL DEFAULT 'Thanks for your message. A team member will get back to you shortly.',
    "handoverKeywords" TEXT[] NOT NULL DEFAULT ARRAY['human', 'agent', 'support', 'representative']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TenantAiSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantAiSettings_tenantId_key" ON "TenantAiSettings"("tenantId");
CREATE INDEX "TenantAiSettings_tenantId_idx" ON "TenantAiSettings"("tenantId");
CREATE INDEX "TenantAiSettings_tenantId_isEnabled_idx" ON "TenantAiSettings"("tenantId", "isEnabled");
CREATE INDEX "TenantAiSettings_createdAt_idx" ON "TenantAiSettings"("createdAt");
CREATE INDEX "TenantAiSettings_deletedAt_idx" ON "TenantAiSettings"("deletedAt");

ALTER TABLE "TenantAiSettings" ADD CONSTRAINT "TenantAiSettings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

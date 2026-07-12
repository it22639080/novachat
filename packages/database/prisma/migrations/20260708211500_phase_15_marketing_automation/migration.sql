CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'en_US',
    "category" TEXT NOT NULL DEFAULT 'MARKETING',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "bodyText" TEXT NOT NULL,
    "components" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppTemplate_tenantId_name_languageCode_key" ON "WhatsAppTemplate"("tenantId", "name", "languageCode");
CREATE INDEX "WhatsAppTemplate_tenantId_idx" ON "WhatsAppTemplate"("tenantId");
CREATE INDEX "WhatsAppTemplate_tenantId_status_idx" ON "WhatsAppTemplate"("tenantId", "status");
CREATE INDEX "WhatsAppTemplate_tenantId_category_idx" ON "WhatsAppTemplate"("tenantId", "category");
CREATE INDEX "WhatsAppTemplate_tenantId_name_idx" ON "WhatsAppTemplate"("tenantId", "name");
CREATE INDEX "WhatsAppTemplate_createdAt_idx" ON "WhatsAppTemplate"("createdAt");
CREATE INDEX "WhatsAppTemplate_deletedAt_idx" ON "WhatsAppTemplate"("deletedAt");

ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

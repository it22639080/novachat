-- Keep the fresh migration path aligned with the current Prisma schema.
-- These objects may already be absent in existing development databases.

DROP INDEX IF EXISTS "KnowledgeBaseChunk_tenantId_documentId_position_idx";
DROP INDEX IF EXISTS "KnowledgeBaseDocument_tenantId_checksum_idx";

ALTER TABLE IF EXISTS "CreditTopUp" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE IF EXISTS "TenantCreditBalance" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE IF EXISTS "TenantUsageCounter" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE IF EXISTS "TenantUsageLimit" ALTER COLUMN "updatedAt" DROP DEFAULT;

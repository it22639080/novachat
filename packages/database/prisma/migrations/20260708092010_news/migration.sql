-- DropIndex
DROP INDEX IF EXISTS "KnowledgeBaseChunk_tenantId_documentId_position_idx";

-- DropIndex
DROP INDEX IF EXISTS "KnowledgeBaseDocument_tenantId_checksum_idx";

-- AlterTable
ALTER TABLE IF EXISTS "CreditTopUp" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "TenantCreditBalance" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "TenantUsageCounter" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "TenantUsageLimit" ALTER COLUMN "updatedAt" DROP DEFAULT;

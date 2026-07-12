CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "KnowledgeSourceType" AS ENUM ('FILE', 'URL');

ALTER TABLE "KnowledgeBaseDocument"
  ADD COLUMN "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'FILE',
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN "error" TEXT,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "KnowledgeBaseChunk"
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sourceTitle" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE INDEX "KnowledgeBaseDocument_tenantId_status_idx" ON "KnowledgeBaseDocument"("tenantId", "status");
CREATE INDEX "KnowledgeBaseDocument_tenantId_sourceType_idx" ON "KnowledgeBaseDocument"("tenantId", "sourceType");
CREATE INDEX "KnowledgeBaseDocument_tenantId_checksum_idx" ON "KnowledgeBaseDocument"("tenantId", "checksum");
CREATE INDEX "KnowledgeBaseChunk_tenantId_documentId_position_idx" ON "KnowledgeBaseChunk"("tenantId", "documentId", "position");

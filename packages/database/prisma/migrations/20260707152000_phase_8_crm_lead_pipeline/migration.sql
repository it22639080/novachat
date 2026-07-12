ALTER TABLE "Lead" ADD COLUMN "assignedUserId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "expectedCloseDate" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "followUpAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "followUpNote" TEXT;
ALTER TABLE "Lead" ADD COLUMN "aiScoreMetadata" JSONB;
ALTER TABLE "Lead" ADD COLUMN "aiNextAction" TEXT;

CREATE INDEX "Lead_tenantId_assignedUserId_idx" ON "Lead"("tenantId", "assignedUserId");
CREATE INDEX "Lead_tenantId_followUpAt_idx" ON "Lead"("tenantId", "followUpAt");
CREATE INDEX "Lead_tenantId_expectedCloseDate_idx" ON "Lead"("tenantId", "expectedCloseDate");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

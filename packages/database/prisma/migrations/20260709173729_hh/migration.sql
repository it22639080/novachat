-- AlterTable
ALTER TABLE "AiAgent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AiAgentVersion" ALTER COLUMN "updatedAt" DROP DEFAULT;

DO $$
BEGIN
  IF to_regclass('public."WhatsAppWebhookLog"') IS NOT NULL THEN
    ALTER TABLE "WhatsAppWebhookLog" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

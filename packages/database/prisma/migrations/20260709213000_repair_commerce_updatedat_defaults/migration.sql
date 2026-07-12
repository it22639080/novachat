DO $$
BEGIN
  IF to_regclass('public."AiToolCallLog"') IS NOT NULL THEN
    ALTER TABLE "AiToolCallLog" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;

  IF to_regclass('public."OrderTimelineEvent"') IS NOT NULL THEN
    ALTER TABLE "OrderTimelineEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;

  IF to_regclass('public."ProductImage"') IS NOT NULL THEN
    ALTER TABLE "ProductImage" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;

  IF to_regclass('public."WhatsAppWebhookLog"') IS NOT NULL THEN
    ALTER TABLE "WhatsAppWebhookLog" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

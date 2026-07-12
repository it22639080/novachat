UPDATE "TenantAiSettings"
SET "modelName" = 'gpt-4o-mini'
WHERE "modelName" IN ('gpt-4.0-mini', 'gpt-4.1-mini');

UPDATE "AiAssistant"
SET "modelName" = 'gpt-4o-mini'
WHERE "modelName" IN ('gpt-4.0-mini', 'gpt-4.1-mini');

ALTER TABLE "TenantAiSettings" ALTER COLUMN "modelName" SET DEFAULT 'gpt-4o-mini';
ALTER TABLE "AiAssistant" ALTER COLUMN "modelName" SET DEFAULT 'gpt-4o-mini';

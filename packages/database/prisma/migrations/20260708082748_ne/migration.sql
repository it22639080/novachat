-- AlterTable
ALTER TABLE "AiAssistant" ALTER COLUMN "modelName" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Chatbot" ALTER COLUMN "modelName" SET DEFAULT 'gpt-4o-mini';

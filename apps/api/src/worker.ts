import { logger } from "./infrastructure/logger/logger.js";
import { startCampaignWorker } from "./infrastructure/queue/campaign-worker.js";
import { requeuePendingKnowledgeDocuments, startKnowledgeWorker } from "./infrastructure/queue/knowledge-worker.js";
import { scheduleUsageJobs, startUsageWorker } from "./infrastructure/queue/usage-worker.js";
import { waitForDatabase, waitForRedis } from "./infrastructure/startup/startup-checks.js";

async function bootstrapWorker() {
  await waitForDatabase();
  await waitForRedis();

  startKnowledgeWorker();
  startUsageWorker();
  startCampaignWorker();
  await scheduleUsageJobs();
  await requeuePendingKnowledgeDocuments();

  logger.info("NovaChat worker started");
  logger.info("Usage reset jobs scheduled: monthly usage reset and daily AI cost reset");
}

void bootstrapWorker().catch((error) => {
  logger.fatal({ err: error }, "NovaChat worker failed to start");
  process.exit(1);
});

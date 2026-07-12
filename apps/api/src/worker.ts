import { prisma } from "@novachat/database";
import { logger } from "./infrastructure/logger/logger.js";
import { startCampaignWorker } from "./infrastructure/queue/campaign-worker.js";
import { requeuePendingKnowledgeDocuments, startKnowledgeWorker } from "./infrastructure/queue/knowledge-worker.js";
import { closeQueues } from "./infrastructure/queue/queue.js";
import { scheduleUsageJobs, startUsageWorker } from "./infrastructure/queue/usage-worker.js";
import { waitForDatabase, waitForRedis } from "./infrastructure/startup/startup-checks.js";

async function bootstrapWorker() {
  await waitForDatabase();
  await waitForRedis();

  const workers = [startKnowledgeWorker(), startUsageWorker(), startCampaignWorker()];
  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals) {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "NovaChat worker shutting down");
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    await prisma.$disconnect();
    logger.info("NovaChat worker shutdown complete");
  }

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM").then(() => process.exit(0)).catch((error) => {
      logger.error({ err: error }, "NovaChat worker shutdown failed");
      process.exit(1);
    });
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT").then(() => process.exit(0)).catch((error) => {
      logger.error({ err: error }, "NovaChat worker shutdown failed");
      process.exit(1);
    });
  });

  await scheduleUsageJobs();
  await requeuePendingKnowledgeDocuments();

  logger.info("NovaChat worker started");
  logger.info("Usage reset jobs scheduled: monthly usage reset and daily AI cost reset");
}

void bootstrapWorker().catch((error) => {
  logger.fatal({ err: error }, "NovaChat worker failed to start");
  process.exit(1);
});

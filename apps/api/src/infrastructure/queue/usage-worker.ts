import { Worker } from "bullmq";
import { env } from "../../config/env.js";
import { UsageService } from "../../application/services/usage-service.js";
import { logger } from "../logger/logger.js";
import { usageQueue } from "./queue.js";

const redisUrl = new URL(env.REDIS_URL);
const usageService = new UsageService();

type UsageJob = {
  type: "monthly-reset" | "daily-cost-reset";
};

export async function scheduleUsageJobs() {
  await usageQueue.add(
    "monthly-reset",
    { type: "monthly-reset" } satisfies UsageJob,
    { jobId: "monthly-usage-reset", repeat: { pattern: "0 0 1 * *" } }
  );
  await usageQueue.add(
    "daily-cost-reset",
    { type: "daily-cost-reset" } satisfies UsageJob,
    { jobId: "daily-ai-cost-reset", repeat: { pattern: "0 0 * * *" } }
  );
}

export function startUsageWorker() {
  const worker = new Worker<UsageJob>(
    "usage",
    async (job) => {
      if (job.data.type === "monthly-reset") {
        return usageService.runMonthlyReset();
      }

      return usageService.runDailyCostReset();
    },
    {
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        maxRetriesPerRequest: null
      },
      concurrency: 1
    }
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, type: job.data.type }, "Usage job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, type: job?.data.type, err: error }, "Usage job failed");
  });

  worker.on("error", (error) => {
    logger.error({ err: error }, "Usage worker connection error. Redis 5 or newer is required.");
  });

  return worker;
}

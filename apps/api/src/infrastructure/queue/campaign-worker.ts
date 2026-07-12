import { Worker } from "bullmq";
import { env } from "../../config/env.js";
import { CampaignService } from "../../application/services/campaign-service.js";
import { logger } from "../logger/logger.js";

const redisUrl = new URL(env.REDIS_URL);
const campaignService = new CampaignService();

type CampaignJob = {
  campaignId: string;
  tenantId: string;
};

export function startCampaignWorker() {
  const worker = new Worker<CampaignJob>(
    "campaign",
    async (job) => {
      logger.info({ jobId: job.id, campaignId: job.data.campaignId, tenantId: job.data.tenantId }, "Campaign send started");
      return campaignService.processCampaign(job.data.campaignId, job.data.tenantId);
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
    logger.info({ jobId: job.id, campaignId: job.data.campaignId }, "Campaign send completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, campaignId: job?.data.campaignId, err: error }, "Campaign send failed");
  });

  worker.on("error", (error) => {
    logger.error({ err: error }, "Campaign worker connection error. Redis 5 or newer is required.");
  });

  return worker;
}

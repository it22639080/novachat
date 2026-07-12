import { Worker } from "bullmq";
import { env } from "../../config/env.js";
import { KnowledgeService } from "../../application/services/knowledge-service.js";
import { logger } from "../logger/logger.js";

const redisUrl = new URL(env.REDIS_URL);
const knowledgeService = new KnowledgeService();

export async function requeuePendingKnowledgeDocuments() {
  return knowledgeService.enqueuePendingDocuments();
}

export function startKnowledgeWorker() {
  const worker = new Worker<{ documentId: string; tenantId: string }>(
    "knowledge",
    async (job) => {
      logger.info({ jobId: job.id, documentId: job.data.documentId, tenantId: job.data.tenantId }, "Knowledge document processing started");
      await knowledgeService.processDocument(job.data.documentId, job.data.tenantId);
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
    logger.info({ jobId: job.id, documentId: job.data.documentId }, "Knowledge document processed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "Knowledge document processing failed");
  });

  worker.on("error", (error) => {
    logger.error({ err: error }, "Knowledge worker connection error. Redis 5 or newer is required.");
  });

  return worker;
}

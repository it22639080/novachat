import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import { logger } from "../logger/logger.js";

const redisUrl = new URL(env.REDIS_URL);
type QueueLike = Pick<Queue, "add" | "close" | "on" | "name">;
export type WhatsAppOutboundQueueJob = {
  outboundJobId: string;
  tenantId: string;
  connectionId: string;
  providerType: "META_CLOUD" | "WHATSAPP_WEB_EXPERIMENTAL";
  conversationId: string;
  incomingMessageId: string | null;
  internalMessageId: string;
  recipient: string;
  text: string;
  origin: "AI" | "AGENT" | "SYSTEM";
};
const isTestRuntime =
  env.NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  Boolean(process.env.VITEST_WORKER_ID) ||
  process.env.npm_lifecycle_event?.startsWith("test");

function createQueue(name: string, delay: number, removeOnComplete: number, removeOnFail: number): QueueLike {
  if (isTestRuntime) {
    return {
      name,
      add: async (jobName: string) => ({ id: `test-${name}-${jobName}` }) as Awaited<ReturnType<Queue["add"]>>,
      close: async () => undefined,
      on: () => undefined as unknown as Queue
    };
  }

  return new Queue(name, {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      maxRetriesPerRequest: null
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay
      },
      removeOnComplete,
      removeOnFail
    }
  });
}

export const foundationQueue = createQueue("foundation", 1000, 100, 500);

export const knowledgeQueue = createQueue("knowledge", 3000, 250, 1000);

export const usageQueue = createQueue("usage", 3000, 100, 500);

export const campaignQueue = createQueue("campaign", 5000, 250, 1000);

export const whatsappOutboundQueue = createQueue("whatsapp-outbound", 2000, 500, 1000);

for (const queue of [foundationQueue, knowledgeQueue, usageQueue, campaignQueue, whatsappOutboundQueue]) {
  queue.on("error", (error) => {
    logger.error(
      {
        queue: queue.name,
        redisUrl: env.REDIS_URL.replace(/\/\/([^:@]+):([^@]+)@/, "//[REDACTED]@"),
        err: error
      },
      "BullMQ queue connection error. Redis 5 or newer is required."
    );
  });
}

export async function closeQueues() {
  await Promise.all(
    [foundationQueue, knowledgeQueue, usageQueue, campaignQueue, whatsappOutboundQueue].map((queue) => queue.close())
  );
}

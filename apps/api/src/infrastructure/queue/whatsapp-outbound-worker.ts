import { Worker } from "bullmq";
import { prisma } from "@novachat/database";
import { env } from "../../config/env.js";
import { whatsAppProviderRegistry } from "../../application/whatsapp/whatsapp-provider-registry.js";
import { whatsAppOutboundService } from "../../application/services/whatsapp-outbound-service.js";
import { UsageService } from "../../application/services/usage-service.js";
import { AppError } from "../../shared/errors/app-error.js";
import { publishTenantEvent } from "../realtime/realtime.js";
import { logger } from "../logger/logger.js";
import type { WhatsAppOutboundQueueJob } from "./queue.js";

const redisUrl = new URL(env.REDIS_URL);
const usageService = new UsageService();

function isAuthenticationFailure(error: unknown) {
  return error instanceof AppError && ["AUTH_FAILURE", "SESSION_EXPIRED"].includes(error.code);
}

function isUsageLimit(error: unknown) {
  return error instanceof AppError && error.code.includes("LIMIT");
}

export function startWhatsAppOutboundWorker() {
  const worker = new Worker<WhatsAppOutboundQueueJob>(
    "whatsapp-outbound",
    async (job) => {
      const data = job.data;
      logger.info(
        {
          jobId: job.id,
          tenantId: data.tenantId,
          connectionId: data.connectionId,
          providerType: data.providerType,
          origin: data.origin
        },
        "WhatsApp outbound job started"
      );

      await prisma.whatsAppOutboundJob.updateMany({
        where: { id: data.outboundJobId, tenantId: data.tenantId, status: "QUEUED" },
        data: { status: "PROCESSING", attempts: { increment: 1 } }
      });

      let reservation: Awaited<ReturnType<UsageService["reserveWhatsappMessage"]>> | null = null;

      try {
        reservation = await usageService.reserveWhatsappMessage(data.tenantId);
        const provider = whatsAppProviderRegistry.get(data.providerType);
        const result = await provider.sendText({
          tenantId: data.tenantId,
          connectionId: data.connectionId,
          recipient: data.recipient,
          text: data.text,
          internalMessageId: data.internalMessageId
        });

        await usageService.recordWhatsappMessage(data.tenantId, {
          source: data.origin.toLowerCase(),
          providerType: data.providerType,
          connectionId: data.connectionId,
          conversationId: data.conversationId,
          providerMessageId: result.providerMessageId ?? null
        });
        await whatsAppOutboundService.markSent({
          tenantId: data.tenantId,
          outboundJobId: data.outboundJobId,
          internalMessageId: data.internalMessageId,
          externalMessageId: result.providerMessageId,
          rawResponse: result.rawResponse
        });

        publishTenantEvent(data.tenantId, "message:new", {
          conversationId: data.conversationId,
          messageId: data.internalMessageId,
          direction: "OUTBOUND",
          status: "SENT"
        });
        publishTenantEvent(data.tenantId, "conversation:updated", {
          conversationId: data.conversationId
        });

        return result;
      } catch (error) {
        if (reservation) {
          await usageService.releaseWhatsappReservation(data.tenantId, reservation);
        }

        const message = error instanceof Error ? error.message : "WhatsApp outbound send failed";
        const shouldRetry = job.attemptsMade < 2 && !isAuthenticationFailure(error) && !isUsageLimit(error);
        await whatsAppOutboundService.markFailed({
          tenantId: data.tenantId,
          outboundJobId: data.outboundJobId,
          internalMessageId: data.internalMessageId,
          reason: message,
          blocked: isUsageLimit(error)
        });

        logger.error(
          {
            jobId: job.id,
            tenantId: data.tenantId,
            connectionId: data.connectionId,
            providerType: data.providerType,
            retrying: shouldRetry,
            err: error
          },
          "WhatsApp outbound job failed"
        );

        if (shouldRetry) {
          throw error;
        }

        return { failed: true, message };
      }
    },
    {
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        maxRetriesPerRequest: null
      },
      concurrency: 3
    }
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, origin: job.data.origin }, "WhatsApp outbound job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "WhatsApp outbound worker failure");
  });

  worker.on("error", (error) => {
    logger.error({ err: error }, "WhatsApp outbound worker connection error. Redis 5 or newer is required.");
  });

  return worker;
}

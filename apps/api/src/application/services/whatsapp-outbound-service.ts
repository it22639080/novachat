import { Prisma, prisma } from "@novachat/database";
import { MessageProcessingService } from "./message-processing-service.js";
import { whatsappOutboundQueue, type WhatsAppOutboundQueueJob } from "../../infrastructure/queue/queue.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { notFound } from "../../shared/errors/app-error.js";

type OutboundOrigin = "AI" | "AGENT" | "SYSTEM";

const messageProcessingService = new MessageProcessingService();

function normalizePhone(value: string) {
  return value.trim().replace(/[^\d+]/g, "");
}

function providerFromAccount(account: { onboardingMethod: string }) {
  return account.onboardingMethod === "WHATSAPP_WEB_EXPERIMENTAL"
    ? "WHATSAPP_WEB_EXPERIMENTAL"
    : "META_CLOUD";
}

export class WhatsAppOutboundService {
  async enqueueConversationText(input: {
    tenantId: string;
    conversationId: string;
    text: string;
    origin: OutboundOrigin;
    incomingMessageId?: string;
  }) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: input.conversationId, tenantId: input.tenantId, deletedAt: null },
      include: {
        customer: true,
        whatsappAccount: true
      }
    });

    if (!conversation) {
      throw notFound("Conversation not found");
    }

    if (!conversation.whatsappAccount || conversation.whatsappAccount.phoneNumberId === "simulator") {
      const result = await messageProcessingService.processOutgoing({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        type: "text",
        text: input.text,
        source: "simulator",
        status: "sent",
        senderType: input.origin === "AI" ? "AI" : input.origin === "SYSTEM" ? "SYSTEM" : "USER"
      });

      return {
        queued: false,
        providerType: "SIMULATOR",
        conversationId: result.conversation.id,
        message: result.message
      };
    }

    const providerType = providerFromAccount(conversation.whatsappAccount);
    const webSession =
      providerType === "WHATSAPP_WEB_EXPERIMENTAL"
        ? await prisma.whatsAppWebSession.findFirst({
            where: {
              tenantId: input.tenantId,
              whatsappAccountId: conversation.whatsappAccount.id,
              deletedAt: null
            }
          })
        : null;
    const connectionId = providerType === "WHATSAPP_WEB_EXPERIMENTAL" ? webSession?.id : conversation.whatsappAccount.id;

    if (!connectionId) {
      throw notFound("Active WhatsApp provider connection not found");
    }

    const result = await messageProcessingService.processOutgoing({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      whatsappAccountId: conversation.whatsappAccount.id,
      type: "text",
      text: input.text,
      source: "whatsapp",
      status: "queued",
      senderType: input.origin === "AI" ? "AI" : input.origin === "SYSTEM" ? "SYSTEM" : "USER",
      providerName:
        providerType === "WHATSAPP_WEB_EXPERIMENTAL"
          ? "whatsapp-web-experimental"
          : "meta-whatsapp-cloud-api"
    });

    const outboundJob = await prisma.whatsAppOutboundJob.create({
      data: {
        tenantId: input.tenantId,
        providerType,
        connectionId,
        conversationId: input.conversationId,
        incomingMessageId: input.incomingMessageId ?? null,
        internalMessageId: result.message.id,
        recipient: normalizePhone(conversation.customer.phone),
        text: input.text,
        origin: input.origin,
        status: "QUEUED"
      }
    });

    await whatsappOutboundQueue.add(
      "send-text",
      {
        outboundJobId: outboundJob.id,
        tenantId: input.tenantId,
        connectionId,
        providerType,
        conversationId: input.conversationId,
        incomingMessageId: input.incomingMessageId ?? null,
        internalMessageId: result.message.id,
        recipient: normalizePhone(conversation.customer.phone),
        text: input.text,
        origin: input.origin
      } satisfies WhatsAppOutboundQueueJob,
      { jobId: outboundJob.id, attempts: 3 }
    );

    logger.info(
      {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        providerType,
        connectionId,
        outboundJobId: outboundJob.id,
        internalMessageId: result.message.id,
        origin: input.origin,
        recipient: maskRecipient(normalizePhone(conversation.customer.phone)),
        textLength: input.text.length
      },
      "WhatsApp outbound message queued"
    );

    return {
      queued: true,
      providerType,
      outboundJobId: outboundJob.id,
      conversationId: result.conversation.id,
      message: result.message
    };
  }

  async markSent(input: {
    tenantId: string;
    outboundJobId: string;
    internalMessageId: string;
    externalMessageId: string | null;
    rawResponse?: unknown;
  }) {
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppOutboundJob.updateMany({
        where: { id: input.outboundJobId, tenantId: input.tenantId },
        data: {
          status: "SENT",
          externalMessageId: input.externalMessageId,
          sentAt: new Date(),
          failureReason: null
        }
      });

      await tx.message.updateMany({
        where: { id: input.internalMessageId, tenantId: input.tenantId },
        data: {
          status: "SENT",
          ...(input.externalMessageId ? { externalId: input.externalMessageId } : {}),
          metadata: {
            providerMessageId: input.externalMessageId,
            rawResponse: input.rawResponse ?? null
          } as Prisma.InputJsonValue
        }
      });
    });
  }

  async markFailed(input: {
    tenantId: string;
    outboundJobId: string;
    internalMessageId: string;
    reason: string;
    blocked?: boolean;
  }) {
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppOutboundJob.updateMany({
        where: { id: input.outboundJobId, tenantId: input.tenantId },
        data: {
          status: input.blocked ? "BLOCKED" : "FAILED",
          failureReason: input.reason,
          attempts: { increment: 1 }
        }
      });

      await tx.message.updateMany({
        where: { id: input.internalMessageId, tenantId: input.tenantId },
        data: {
          status: "FAILED",
          metadata: {
            failureReason: input.reason
          } as Prisma.InputJsonValue
        }
      });
    });
  }
}

export const whatsAppOutboundService = new WhatsAppOutboundService();

function maskRecipient(value: string) {
  if (value.length <= 4) {
    return "****";
  }

  return `${"*".repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
}

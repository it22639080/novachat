import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@novachat/database";
import { notFound } from "../../shared/errors/app-error.js";
import { publishTenantEvent } from "../../infrastructure/realtime/realtime.js";

export type ProcessingMessageType = "text" | "image" | "document" | "button_reply" | "list_reply";
export type ProcessingDeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

type IncomingInput = {
  tenantId: string;
  phone: string;
  name?: string;
  type: ProcessingMessageType;
  text?: string;
  mediaUrl?: string;
  interactivePayload?: {
    id: string;
    title: string;
    description?: string;
  };
  source: "simulator" | "whatsapp";
  externalId?: string;
  whatsappAccountId?: string;
  whatsappWaId?: string;
  rawPayload?: unknown;
};

type OutgoingInput = {
  tenantId: string;
  conversationId: string;
  type: ProcessingMessageType;
  text?: string;
  mediaUrl?: string;
  status?: ProcessingDeliveryStatus;
  source: "simulator" | "whatsapp";
  externalId?: string;
  whatsappAccountId?: string;
  rawPayload?: unknown;
  senderType?: "USER" | "AI" | "SYSTEM";
};

const simulatorPhoneNumberId = "simulator";

function normalizePhone(phone: string) {
  return phone.trim().replace(/[^\d+]/g, "");
}

function toPrismaMessageType(type: ProcessingMessageType) {
  if (type === "image") {
    return "IMAGE";
  }

  if (type === "document") {
    return "DOCUMENT";
  }

  if (type === "button_reply" || type === "list_reply") {
    return "INTERACTIVE";
  }

  return "TEXT";
}

function toPrismaMessageStatus(status: ProcessingDeliveryStatus | undefined) {
  switch (status) {
    case "queued":
      return "QUEUED";
    case "delivered":
      return "DELIVERED";
    case "read":
      return "READ";
    case "failed":
      return "FAILED";
    case "sent":
    default:
      return "SENT";
  }
}

function displayText(input: Pick<IncomingInput | OutgoingInput, "type" | "text" | "mediaUrl">) {
  if (input.text) {
    return input.text;
  }

  if (input.type === "image") {
    return "Image message";
  }

  if (input.type === "document") {
    return "Document message";
  }

  return "Interactive reply";
}

function requireWhatsAppAccountId(accountId: string | undefined) {
  if (!accountId) {
    throw notFound("WhatsApp account not found");
  }

  return accountId;
}

export class MessageProcessingService {
  async ensureSimulatorWhatsAppAccount(tenantId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.whatsAppAccount.upsert({
      where: {
        tenantId_phoneNumberId: {
          tenantId,
          phoneNumberId: simulatorPhoneNumberId
        }
      },
      update: {
        status: "CONNECTED",
        displayName: "WhatsApp Simulator"
      },
      create: {
        tenantId,
        businessAccountId: "simulator",
        phoneNumberId: simulatorPhoneNumberId,
        displayPhoneNumber: "+10000000000",
        displayName: "WhatsApp Simulator",
        status: "CONNECTED"
      }
    });
  }

  async findOrCreateCustomer(input: { tenantId: string; phone: string; name?: string }) {
    const phone = normalizePhone(input.phone);

    return prisma.customer.upsert({
      where: {
        tenantId_phone: {
          tenantId: input.tenantId,
          phone
        }
      },
      update: {
        ...(input.name ? { name: input.name } : {}),
        whatsappWaId: `simulator:${phone}`,
        customFields: {
          source: "simulator"
        }
      },
      create: {
        tenantId: input.tenantId,
        phone,
        name: input.name ?? null,
        whatsappWaId: `simulator:${phone}`,
        customFields: {
          source: "simulator"
        }
      }
    });
  }

  async processIncoming(input: IncomingInput) {
    const phone = normalizePhone(input.phone);
    const externalId =
      input.externalId ?? `${input.source === "whatsapp" ? "wa" : "sim"}_in_${randomUUID()}`;

    const result = await prisma.$transaction(async (tx) => {
      const whatsAppAccount =
        input.source === "simulator"
          ? await this.ensureSimulatorWhatsAppAccount(input.tenantId, tx)
          : await tx.whatsAppAccount.findFirstOrThrow({
              where: {
                id: requireWhatsAppAccountId(input.whatsappAccountId),
                tenantId: input.tenantId,
                deletedAt: null
              }
            });
      const customer = await tx.customer.upsert({
        where: {
          tenantId_phone: {
            tenantId: input.tenantId,
            phone
          }
        },
        update: {
          ...(input.name ? { name: input.name } : {}),
          whatsappWaId: input.whatsappWaId ?? `${input.source}:${phone}`,
          customFields: {
            source: input.source
          }
        },
        create: {
          tenantId: input.tenantId,
          phone,
          name: input.name ?? null,
          whatsappWaId: input.whatsappWaId ?? `${input.source}:${phone}`,
          customFields: {
            source: input.source
          }
        }
      });

      const existingConversation = await tx.conversation.findFirst({
        where: {
          tenantId: input.tenantId,
          customerId: customer.id,
          status: { in: ["OPEN", "PENDING"] },
          deletedAt: null
        },
        orderBy: {
          lastMessageAt: "desc"
        }
      });

      const conversation =
        existingConversation ??
        (await tx.conversation.create({
          data: {
            tenantId: input.tenantId,
            customerId: customer.id,
            whatsappAccountId: whatsAppAccount.id,
            status: "OPEN",
            subject:
              input.source === "simulator"
                ? `Simulator chat with ${customer.name ?? customer.phone}`
                : `WhatsApp chat with ${customer.name ?? customer.phone}`
          }
        }));

      const now = new Date();
      const message = await tx.message.create({
        data: {
          tenantId: input.tenantId,
          conversationId: conversation.id,
          customerId: customer.id,
          whatsappAccountId: whatsAppAccount.id,
          direction: "INBOUND",
          senderType: "CUSTOMER",
          type: toPrismaMessageType(input.type),
          status: "RECEIVED",
          text: displayText(input),
          mediaUrl: input.mediaUrl ?? null,
          externalId,
          metadata: {
            source: input.source,
            provider: input.source === "whatsapp" ? "meta-whatsapp-cloud-api" : "simulator",
            providerMessageId: externalId,
            messageType: input.type,
            interactivePayload: input.interactivePayload ?? null,
            rawPayload: input.rawPayload ?? null
          }
        }
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: now,
          status: "OPEN"
        }
      });

      return {
        customer,
        conversation,
        message,
        response: null
      };
    });

    publishTenantEvent(input.tenantId, "message:new", {
      conversationId: result.conversation.id,
      messageId: result.message.id,
      direction: result.message.direction,
      source: input.source
    });
    publishTenantEvent(input.tenantId, "conversation:updated", {
      conversationId: result.conversation.id,
      lastMessageAt: result.message.createdAt.toISOString(),
      status: "OPEN"
    });

    return result;
  }

  async processOutgoing(input: OutgoingInput) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: input.conversationId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      include: {
        customer: true
      }
    });

    if (!conversation) {
      throw notFound("Conversation not found");
    }

    const whatsAppAccount =
      input.source === "simulator"
        ? await this.ensureSimulatorWhatsAppAccount(input.tenantId)
        : await prisma.whatsAppAccount.findFirstOrThrow({
            where: {
              id: requireWhatsAppAccountId(input.whatsappAccountId ?? conversation.whatsappAccountId ?? undefined),
              tenantId: input.tenantId,
              deletedAt: null
            }
          });

    const message = await prisma.message.create({
      data: {
        tenantId: input.tenantId,
        conversationId: conversation.id,
        customerId: conversation.customerId,
        whatsappAccountId: conversation.whatsappAccountId ?? whatsAppAccount.id,
        direction: "OUTBOUND",
        senderType: input.senderType ?? "USER",
        type: toPrismaMessageType(input.type),
        status: toPrismaMessageStatus(input.status),
        text: displayText(input),
        mediaUrl: input.mediaUrl ?? null,
        externalId: input.externalId ?? `${input.source === "whatsapp" ? "wa" : "sim"}_out_${randomUUID()}`,
        metadata: {
          source: input.source,
          provider: input.source === "whatsapp" ? "meta-whatsapp-cloud-api" : "simulator",
          messageType: input.type,
          deliveryStatus: input.status ?? "sent",
          rawPayload: input.rawPayload ?? null
        }
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date()
      }
    });

    publishTenantEvent(input.tenantId, "message:new", {
      conversationId: conversation.id,
      messageId: message.id,
      direction: message.direction,
      source: input.source
    });
    publishTenantEvent(input.tenantId, "conversation:updated", {
      conversationId: conversation.id,
      lastMessageAt: message.createdAt.toISOString(),
      status: conversation.status
    });

    return {
      conversation,
      message
    };
  }
}

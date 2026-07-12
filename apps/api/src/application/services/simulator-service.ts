import { prisma } from "@novachat/database";
import type {
  CreateSimulatorCustomerInput,
  IncomingSimulatorMessageInput,
  OutgoingSimulatorMessageInput
} from "@novachat/shared-types";
import { AiAssistantEngineService } from "./ai-assistant-engine-service.js";
import { MessageProcessingService } from "./message-processing-service.js";

const messageProcessingService = new MessageProcessingService();
const aiAssistantEngineService = new AiAssistantEngineService();

function serializeMessage(message: {
  id: string;
  direction: string;
  senderType: string;
  type: string;
  status: string;
  text: string | null;
  mediaUrl: string | null;
  metadata: unknown;
  createdAt: Date;
}) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString()
  };
}

function serializeCustomer(customer: {
  id: string;
  name: string | null;
  phone: string;
  status: string;
  createdAt: Date;
}) {
  return {
    ...customer,
    createdAt: customer.createdAt.toISOString()
  };
}

function serializeConversation(conversation: {
  id: string;
  status: string;
  subject: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  customer: {
    id: string;
    name: string | null;
    phone: string;
  };
  messages: Array<Parameters<typeof serializeMessage>[0]>;
}) {
  return {
    id: conversation.id,
    status: conversation.status,
    subject: conversation.subject,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    customer: conversation.customer,
    messages: conversation.messages.map(serializeMessage)
  };
}

export class SimulatorService {
  async createCustomer(tenantId: string, input: CreateSimulatorCustomerInput) {
    await messageProcessingService.ensureSimulatorWhatsAppAccount(tenantId);
    const customer = await messageProcessingService.findOrCreateCustomer({
      tenantId,
      phone: input.phone,
      ...(input.name ? { name: input.name } : {})
    });

    return serializeCustomer(customer);
  }

  async listCustomers(tenantId: string) {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId,
        whatsappWaId: {
          startsWith: "simulator:"
        },
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return customers.map(serializeCustomer);
  }

  async incomingMessage(tenantId: string, input: IncomingSimulatorMessageInput) {
    const interactivePayload = input.interactivePayload
      ? {
          id: input.interactivePayload.id,
          title: input.interactivePayload.title,
          ...(input.interactivePayload.description
            ? { description: input.interactivePayload.description }
            : {})
        }
      : undefined;

    const result = await messageProcessingService.processIncoming({
      tenantId,
      source: "simulator",
      phone: input.phone,
      type: input.type,
      ...(input.name ? { name: input.name } : {}),
      ...(input.text ? { text: input.text } : {}),
      ...(input.mediaUrl ? { mediaUrl: input.mediaUrl } : {}),
      ...(interactivePayload ? { interactivePayload } : {})
    });
    const aiResult = await aiAssistantEngineService.handleIncomingMessage({
      tenantId,
      conversationId: result.conversation.id,
      source: "simulator"
    });
    const aiMessage =
      "reply" in aiResult && aiResult.reply ? serializeMessage(aiResult.reply.message) : null;

    return {
      customer: serializeCustomer(result.customer),
      conversationId: result.conversation.id,
      message: serializeMessage(result.message),
      response: aiMessage
    };
  }

  async outgoingMessage(tenantId: string, input: OutgoingSimulatorMessageInput) {
    const result = await messageProcessingService.processOutgoing({
      tenantId,
      source: "simulator",
      conversationId: input.conversationId,
      type: input.type,
      status: input.status,
      ...(input.text ? { text: input.text } : {}),
      ...(input.mediaUrl ? { mediaUrl: input.mediaUrl } : {})
    });

    return {
      conversationId: result.conversation.id,
      message: serializeMessage(result.message)
    };
  }

  async listConversations(tenantId: string) {
    const simulatorAccount = await messageProcessingService.ensureSimulatorWhatsAppAccount(tenantId);
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        whatsappAccountId: simulatorAccount.id,
        deletedAt: null
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        messages: {
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            direction: true,
            senderType: true,
            type: true,
            status: true,
            text: true,
            mediaUrl: true,
            metadata: true,
            createdAt: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      },
      orderBy: [
        {
          lastMessageAt: "desc"
        },
        {
          createdAt: "desc"
        }
      ]
    });

    return conversations.map(serializeConversation);
  }

  async reset(tenantId: string) {
    const simulatorAccount = await messageProcessingService.ensureSimulatorWhatsAppAccount(tenantId);
    const simulatorCustomers = await prisma.customer.findMany({
      where: {
        tenantId,
        whatsappWaId: {
          startsWith: "simulator:"
        }
      },
      select: {
        id: true
      }
    });

    const simulatorCustomerIds = simulatorCustomers.map((customer) => customer.id);

    return prisma.$transaction(async (tx) => {
      const deletedMessages = await tx.message.deleteMany({
        where: {
          tenantId,
          OR: [
            { whatsappAccountId: simulatorAccount.id },
            { externalId: { startsWith: "sim_" } },
            { customerId: { in: simulatorCustomerIds } }
          ]
        }
      });

      const deletedConversations = await tx.conversation.deleteMany({
        where: {
          tenantId,
          OR: [{ whatsappAccountId: simulatorAccount.id }, { customerId: { in: simulatorCustomerIds } }]
        }
      });

      const deletedCustomers = await tx.customer.deleteMany({
        where: {
          tenantId,
          id: {
            in: simulatorCustomerIds
          }
        }
      });

      return {
        deletedMessages: deletedMessages.count,
        deletedConversations: deletedConversations.count,
        deletedCustomers: deletedCustomers.count
      };
    });
  }
}

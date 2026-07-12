import { prisma } from "@novachat/database";
import type {
  InboxAssignConversationInput,
  InboxChangeConversationStatusInput,
  InboxConversationQuery,
  InboxCreateNoteInput,
  InboxSendMessageInput,
  InboxTagInput,
  PlatformRole
} from "@novachat/shared-types";
import { MessageProcessingService } from "./message-processing-service.js";
import { WhatsAppService } from "./whatsapp-service.js";
import { forbidden, notFound } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { publishTenantEvent } from "../../infrastructure/realtime/realtime.js";

type Actor = {
  userId: string;
  role: PlatformRole;
};

const messageProcessingService = new MessageProcessingService();
const whatsAppService = new WhatsAppService();

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function agentVisibilityWhere(actor: Actor) {
  if (actor.role !== "AGENT") {
    return {};
  }

  return {
    OR: [{ assignedUserId: actor.userId }, { assignedUserId: null }]
  };
}

function mapMessage(message: {
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
    id: message.id,
    direction: message.direction,
    senderType: message.senderType,
    type: message.type,
    status: message.status,
    text: message.text,
    mediaUrl: message.mediaUrl,
    metadata: message.metadata,
    createdAt: message.createdAt.toISOString()
  };
}

function mapConversation(conversation: {
  id: string;
  status: string;
  priority: string;
  subject: string | null;
  assignedUserId: string | null;
  aiEnabled: boolean;
  humanHandover: boolean;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string;
    status: string;
    tags: Array<{
      tag: {
        id: string;
        name: string;
        color: string | null;
      };
    }>;
  };
  assignedUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  whatsappAccount: {
    id: string;
    displayName: string | null;
    phoneNumberId: string;
    displayPhoneNumber: string;
  } | null;
  messages: Array<{
    id: string;
    direction: string;
    senderType: string;
    type: string;
    status: string;
    text: string | null;
    mediaUrl: string | null;
    metadata: unknown;
    createdAt: Date;
  }>;
  _count?: {
    notes: number;
  };
}) {
  const lastMessage = conversation.messages[0] ? mapMessage(conversation.messages[0]) : null;

  return {
    id: conversation.id,
    status: conversation.status,
    priority: conversation.priority,
    subject: conversation.subject,
    assignedUserId: conversation.assignedUserId,
    aiEnabled: conversation.aiEnabled,
    humanHandover: conversation.humanHandover,
    assignedUser: conversation.assignedUser,
    lastMessageAt: serializeDate(conversation.lastMessageAt),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    noteCount: conversation._count?.notes ?? 0,
    unreadCount: conversation.messages.filter(
      (message) => message.direction === "INBOUND" && message.status === "RECEIVED"
    ).length,
    lastMessage,
    channel: {
      type: "whatsapp",
      accountId: conversation.whatsappAccount?.id ?? null,
      displayName: conversation.whatsappAccount?.displayName ?? "WhatsApp",
      phoneNumberId: conversation.whatsappAccount?.phoneNumberId ?? null,
      displayPhoneNumber: conversation.whatsappAccount?.displayPhoneNumber ?? null
    },
    customer: {
      ...conversation.customer,
      tags: conversation.customer.tags.map((item) => item.tag)
    }
  };
}

export class InboxService {
  async listConversations(tenantId: string, actor: Actor, query: InboxConversationQuery) {
    const pagination = createPagination(query);
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId === "me" ? { assignedUserId: actor.userId } : {}),
      ...(query.assigneeId === "unassigned" ? { assignedUserId: null } : {}),
      ...(query.assigneeId && query.assigneeId !== "me" && query.assigneeId !== "unassigned"
        ? { assignedUserId: query.assigneeId }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            lastMessageAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {})
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" as const } },
              { customer: { name: { contains: query.search, mode: "insensitive" as const } } },
              { customer: { phone: { contains: query.search, mode: "insensitive" as const } } },
              { customer: { email: { contains: query.search, mode: "insensitive" as const } } }
            ]
          }
        : {}),
      ...(query.tagId ? { customer: { tags: { some: { tagId: query.tagId } } } } : {}),
      ...(query.unread
        ? {
            messages: {
              some: {
                direction: "INBOUND" as const,
                status: "RECEIVED" as const,
                deletedAt: null
              }
            }
          }
        : {}),
      ...agentVisibilityWhere(actor)
    };

    const orderBy =
      query.sortBy === "customerName"
        ? { customer: { name: query.sortDirection } }
        : { [query.sortBy]: query.sortDirection };

    const [items, total] = await prisma.$transaction([
      prisma.conversation.findMany({
        where,
        include: conversationListInclude(),
        orderBy,
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.conversation.count({ where })
    ]);

    return {
      items: items.map(mapConversation),
      pagination: pagination.meta(total)
    };
  }

  async searchConversations(tenantId: string, actor: Actor, query: InboxConversationQuery) {
    return this.listConversations(tenantId, actor, query);
  }

  async getThread(tenantId: string, actor: Actor, conversationId: string) {
    const conversation = await this.getConversationOrThrow(tenantId, actor, conversationId);
    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        conversationId,
        deletedAt: null
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    const notes = await prisma.note.findMany({
      where: {
        tenantId,
        conversationId,
        deletedAt: null
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      conversation: mapConversation(conversation),
      messages: messages.map(mapMessage),
      notes: notes.map((note) => ({
        id: note.id,
        body: note.body,
        author: note.author,
        createdAt: note.createdAt.toISOString()
      }))
    };
  }

  async sendMessage(
    tenantId: string,
    actor: Actor,
    conversationId: string,
    input: InboxSendMessageInput
  ) {
    const conversation = await this.getConversationOrThrow(tenantId, actor, conversationId);
    const source =
      conversation.whatsappAccount?.phoneNumberId === "simulator" ||
      !conversation.whatsappAccount?.id
        ? "simulator"
        : "whatsapp";

    if (source === "whatsapp" && conversation.whatsappAccount?.id) {
      return whatsAppService.sendText(tenantId, {
        accountId: conversation.whatsappAccount.id,
        to: conversation.customer.phone,
        text: input.text
      });
    }

    const result = await messageProcessingService.processOutgoing({
      tenantId,
      conversationId,
      type: input.type,
      text: input.text,
      ...(input.mediaUrl ? { mediaUrl: input.mediaUrl } : {}),
      status: "sent",
      source,
      senderType: "USER"
    });

    return {
      conversationId: result.conversation.id,
      message: mapMessage(result.message)
    };
  }

  async assignConversation(
    tenantId: string,
    actor: Actor,
    conversationId: string,
    input: InboxAssignConversationInput
  ) {
    await this.getConversationOrThrow(tenantId, actor, conversationId);

    if (input.assigneeUserId) {
      const member = await prisma.tenantMember.findFirst({
        where: {
          tenantId,
          userId: input.assigneeUserId,
          status: "ACTIVE",
          deletedAt: null
        }
      });

      if (!member) {
        throw notFound("Assignee is not an active tenant member");
      }
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedUserId: input.assigneeUserId
      },
      include: conversationListInclude()
    });

    publishTenantEvent(tenantId, "conversation:assigned", {
      conversationId,
      assigneeUserId: input.assigneeUserId
    });
    publishTenantEvent(tenantId, "conversation:updated", {
      conversationId,
      assigneeUserId: input.assigneeUserId
    });

    return mapConversation(updated);
  }

  async changeStatus(
    tenantId: string,
    actor: Actor,
    conversationId: string,
    input: InboxChangeConversationStatusInput
  ) {
    await this.getConversationOrThrow(tenantId, actor, conversationId);

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: input.status
      },
      include: conversationListInclude()
    });

    publishTenantEvent(tenantId, "conversation:updated", {
      conversationId,
      status: input.status
    });

    return mapConversation(updated);
  }

  async markRead(tenantId: string, actor: Actor, conversationId: string) {
    await this.getConversationOrThrow(tenantId, actor, conversationId);

    const result = await prisma.message.updateMany({
      where: {
        tenantId,
        conversationId,
        direction: "INBOUND",
        status: "RECEIVED",
        deletedAt: null
      },
      data: {
        status: "READ"
      }
    });

    if (result.count > 0) {
      publishTenantEvent(tenantId, "message:read", {
        conversationId,
        count: result.count
      });
      publishTenantEvent(tenantId, "conversation:updated", {
        conversationId
      });
    }

    return { updated: result.count };
  }

  async createNote(tenantId: string, actor: Actor, conversationId: string, input: InboxCreateNoteInput) {
    const conversation = await this.getConversationOrThrow(tenantId, actor, conversationId);
    const note = await prisma.note.create({
      data: {
        tenantId,
        conversationId,
        customerId: conversation.customerId,
        authorUserId: actor.userId,
        body: input.body
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const payload = {
      id: note.id,
      body: note.body,
      author: note.author,
      conversationId,
      createdAt: note.createdAt.toISOString()
    };

    publishTenantEvent(tenantId, "note:created", payload);
    return payload;
  }

  async addTag(tenantId: string, actor: Actor, conversationId: string, input: InboxTagInput) {
    const conversation = await this.getConversationOrThrow(tenantId, actor, conversationId);

    if (!input.tagId && !input.name) {
      throw notFound("Tag name or tag ID is required");
    }

    const tag = input.tagId
      ? await prisma.tag.findFirst({
          where: {
            id: input.tagId,
            tenantId,
            deletedAt: null
          }
        })
      : await prisma.tag.upsert({
          where: {
            tenantId_name: {
              tenantId,
              name: input.name as string
            }
          },
          update: {
            ...(input.color ? { color: input.color } : {}),
            deletedAt: null
          },
          create: {
            tenantId,
            name: input.name as string,
            color: input.color ?? "#7c3aed"
          }
        });

    if (!tag) {
      throw notFound("Tag not found");
    }

    await prisma.customerTag.upsert({
      where: {
        customerId_tagId: {
          customerId: conversation.customerId,
          tagId: tag.id
        }
      },
      update: {},
      create: {
        customerId: conversation.customerId,
        tagId: tag.id
      }
    });

    publishTenantEvent(tenantId, "conversation:updated", {
      conversationId
    });

    return { tag };
  }

  async removeTag(tenantId: string, actor: Actor, conversationId: string, tagId: string) {
    const conversation = await this.getConversationOrThrow(tenantId, actor, conversationId);
    await prisma.customerTag.deleteMany({
      where: {
        customerId: conversation.customerId,
        tagId,
        tag: {
          tenantId
        }
      }
    });

    publishTenantEvent(tenantId, "conversation:updated", {
      conversationId
    });

    return { removed: true };
  }

  async listAssignees(tenantId: string) {
    const members = await prisma.tenantMember.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        deletedAt: null,
        role: {
          in: ["OWNER", "ADMIN", "MANAGER", "AGENT"]
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      avatarUrl: member.user.avatarUrl,
      role: member.role
    }));
  }

  private async getConversationOrThrow(tenantId: string, actor: Actor, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        deletedAt: null,
        ...agentVisibilityWhere(actor)
      },
      include: conversationListInclude()
    });

    if (!conversation) {
      throw actor.role === "AGENT"
        ? forbidden("Conversation is not assigned to you")
        : notFound("Conversation not found");
    }

    return conversation;
  }
}

function conversationListInclude() {
  return {
    customer: {
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    },
    assignedUser: {
      select: {
        id: true,
        name: true,
        email: true
      }
    },
    whatsappAccount: {
      select: {
        id: true,
        displayName: true,
        phoneNumberId: true,
        displayPhoneNumber: true
      }
    },
    messages: {
      where: {
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc" as const
      },
      take: 10
    },
    _count: {
      select: {
        notes: true
      }
    }
  };
}

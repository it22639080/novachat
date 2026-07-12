import { Prisma, prisma } from "@novachat/database";
import type {
  ChatbotFlowGraph,
  ChatbotFlowSaveInput,
  ChatbotInput,
  ChatbotTestInput,
  ChatbotsQuery,
  ChatbotUpdateInput
} from "@novachat/shared-types";
import { badRequest, notFound } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { BillingService } from "./billing-service.js";

const billingService = new BillingService();

type FlowNode = ChatbotFlowGraph["nodes"][number];
type FlowEdge = ChatbotFlowGraph["edges"][number];

type RuntimeResult = {
  handled: boolean;
  replies: string[];
  handover: boolean;
  reason?: string;
  visitedNodeIds: string[];
};

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "label" in item && typeof item.label === "string") {
        return item.label.trim();
      }
      if (item && typeof item === "object" && "title" in item && typeof item.title === "string") {
        return item.title.trim();
      }
      return "";
    })
    .filter(Boolean);
}

function serializeChatbot(chatbot: ChatbotRecord) {
  const latestFlow = chatbot.flows[0] ?? null;
  const activeFlow = chatbot.flows.find((flow) => flow.isActive) ?? null;

  return {
    id: chatbot.id,
    name: chatbot.name,
    status: chatbot.status,
    systemPrompt: chatbot.systemPrompt,
    modelProvider: chatbot.modelProvider,
    modelName: chatbot.modelName,
    temperature: Number(chatbot.temperature),
    latestFlow: latestFlow ? serializeFlow(latestFlow) : null,
    activeFlow: activeFlow ? serializeFlow(activeFlow) : null,
    createdAt: chatbot.createdAt.toISOString(),
    updatedAt: chatbot.updatedAt.toISOString()
  };
}

function serializeFlow(flow: ChatbotFlowRecord) {
  return {
    id: flow.id,
    chatbotId: flow.chatbotId,
    name: flow.name,
    version: flow.version,
    graph: flow.graph,
    isActive: flow.isActive,
    createdAt: flow.createdAt.toISOString(),
    updatedAt: flow.updatedAt.toISOString()
  };
}

function graphFromJson(value: Prisma.JsonValue) {
  return value as ChatbotFlowGraph;
}

function validateGraph(graph: ChatbotFlowGraph) {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const startNodes = graph.nodes.filter((node) => node.type === "start");

  if (startNodes.length !== 1) {
    errors.push("Flow must contain exactly one start node.");
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} has a missing source node.`);
    }

    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} has a missing target node.`);
    }
  }

  if (startNodes.length === 1) {
    const startNode = startNodes[0];
    if (!startNode) {
      return {
        valid: false,
        errors: ["Flow must contain exactly one start node."]
      };
    }
    const reachable = new Set<string>();
    const queue = [startNode.id];

    while (queue.length) {
      const current = queue.shift();
      if (!current || reachable.has(current)) continue;
      reachable.add(current);
      for (const edge of graph.edges.filter((item) => item.source === current)) {
        queue.push(edge.target);
      }
    }

    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        errors.push(`Node ${node.id} is not reachable from the start node.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function findNextEdge(edges: FlowEdge[], node: FlowNode, message: string) {
  if (node.type === "buttons" || node.type === "list") {
    const normalized = message.toLowerCase();
    return (
      edges.find((edge) => {
        const label = textValue(edge.label ?? edge.sourceHandle).toLowerCase();
        return label && normalized.includes(label);
      }) ?? edges[0]
    );
  }

  if (node.type === "condition") {
    const keyword = textValue(node.data.keyword).toLowerCase();
    const matched = keyword && message.toLowerCase().includes(keyword);
    return edges.find((edge) => textValue(edge.label).toLowerCase() === (matched ? "yes" : "no")) ?? edges[0];
  }

  return edges[0];
}

function nodeReply(node: FlowNode) {
  if (node.type === "text" || node.type === "question") {
    return textValue(node.data.message, node.type === "question" ? "Could you share a little more detail?" : "");
  }

  if (node.type === "buttons") {
    const message = textValue(node.data.message, "Please choose an option:");
    const buttons = stringList(node.data.buttons);
    return buttons.length ? `${message}\n${buttons.map((item) => `- ${item}`).join("\n")}` : message;
  }

  if (node.type === "list") {
    const message = textValue(node.data.message, "Here are the available options:");
    const items = stringList(node.data.items);
    return items.length ? `${message}\n${items.map((item) => `- ${item}`).join("\n")}` : message;
  }

  if (node.type === "collect_info") {
    return textValue(node.data.prompt, "Please share your name, phone number, or email so our team can continue.");
  }

  if (node.type === "product_selection") {
    return textValue(node.data.message, "I can help you choose a product. A team member can confirm availability.");
  }

  if (node.type === "create_order") {
    return textValue(node.data.message, "I can prepare a draft order. Please confirm the product, quantity, and delivery details.");
  }

  if (node.type === "appointment_booking") {
    return textValue(node.data.message, "Please confirm your preferred date, time, name, and contact number for booking.");
  }

  if (node.type === "api_webhook") {
    return textValue(node.data.fallbackMessage, "I need to check that with another system. A team member will continue shortly.");
  }

  if (node.type === "delay") {
    return textValue(node.data.message, "");
  }

  if (node.type === "end") {
    return textValue(node.data.message, "Thanks. We will be here if you need anything else.");
  }

  return "";
}

type ChatbotRecord = Prisma.ChatbotGetPayload<{
  include: {
    flows: {
      where: { deletedAt: null };
      orderBy: { version: "desc" };
    };
  };
}>;

type ChatbotFlowRecord = Prisma.ChatbotFlowGetPayload<Record<string, never>>;

export class ChatbotService {
  async chatbots(tenantId: string, query: ChatbotsQuery) {
    const pagination = createPagination(query);
    const where: Prisma.ChatbotWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { systemPrompt: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [total, items] = await prisma.$transaction([
      prisma.chatbot.count({ where }),
      prisma.chatbot.findMany({
        where,
        include: {
          flows: {
            where: { deletedAt: null },
            orderBy: { version: "desc" }
          }
        },
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return {
      items: items.map(serializeChatbot),
      pagination: pagination.meta(total)
    };
  }

  async createChatbot(tenantId: string, input: ChatbotInput) {
    await billingService.assertPlanAllowance(tenantId, "chatbots");
    const chatbot = await prisma.chatbot.create({
      data: {
        tenantId,
        name: input.name,
        status: input.status,
        systemPrompt: input.systemPrompt,
        modelProvider: input.modelProvider,
        modelName: input.modelName,
        temperature: new Prisma.Decimal(input.temperature)
      },
      include: {
        flows: {
          where: { deletedAt: null },
          orderBy: { version: "desc" }
        }
      }
    });

    return serializeChatbot(chatbot);
  }

  async chatbot(tenantId: string, id: string) {
    const chatbot = await this.findChatbot(tenantId, id);
    return serializeChatbot(chatbot);
  }

  async updateChatbot(tenantId: string, id: string, input: ChatbotUpdateInput) {
    await this.assertChatbotExists(tenantId, id);
    const chatbot = await prisma.chatbot.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
        ...(input.modelProvider !== undefined ? { modelProvider: input.modelProvider } : {}),
        ...(input.modelName !== undefined ? { modelName: input.modelName } : {}),
        ...(input.temperature !== undefined ? { temperature: new Prisma.Decimal(input.temperature) } : {})
      },
      include: {
        flows: {
          where: { deletedAt: null },
          orderBy: { version: "desc" }
        }
      }
    });

    return serializeChatbot(chatbot);
  }

  async deleteChatbot(tenantId: string, id: string) {
    await this.assertChatbotExists(tenantId, id);
    await prisma.chatbot.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        deletedAt: new Date(),
        flows: {
          updateMany: {
            where: { deletedAt: null },
            data: {
              isActive: false,
              deletedAt: new Date()
            }
          }
        }
      }
    });

    return { deleted: true };
  }

  async saveFlow(tenantId: string, chatbotId: string, input: ChatbotFlowSaveInput) {
    await this.assertChatbotExists(tenantId, chatbotId);
    const validation = validateGraph(input.graph);
    if (!validation.valid) {
      throw badRequest("Chatbot flow validation failed", { errors: validation.errors });
    }

    const latest = await prisma.chatbotFlow.findFirst({
      where: { tenantId, chatbotId, deletedAt: null },
      orderBy: { version: "desc" }
    });

    const flow = await prisma.chatbotFlow.create({
      data: {
        tenantId,
        chatbotId,
        name: input.name,
        version: (latest?.version ?? 0) + 1,
        graph: input.graph as Prisma.InputJsonValue,
        isActive: false
      }
    });

    return serializeFlow(flow);
  }

  async publish(tenantId: string, chatbotId: string) {
    await this.assertChatbotExists(tenantId, chatbotId);
    const latest = await prisma.chatbotFlow.findFirst({
      where: { tenantId, chatbotId, deletedAt: null },
      orderBy: { version: "desc" }
    });

    if (!latest) {
      throw badRequest("Save a valid flow before publishing.");
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.chatbotFlow.updateMany({
        where: { tenantId, chatbotId, deletedAt: null },
        data: { isActive: false }
      });
      const activeFlow = await tx.chatbotFlow.update({
        where: { id: latest.id },
        data: { isActive: true }
      });
      const chatbot = await tx.chatbot.update({
        where: { id: chatbotId },
        data: { status: "ACTIVE" },
        include: {
          flows: {
            where: { deletedAt: null },
            orderBy: { version: "desc" }
          }
        }
      });

      return { chatbot, activeFlow };
    });

    return {
      chatbot: serializeChatbot(result.chatbot),
      activeFlow: serializeFlow(result.activeFlow)
    };
  }

  async test(tenantId: string, chatbotId: string, input: ChatbotTestInput) {
    const chatbot = await this.findChatbot(tenantId, chatbotId);
    const activeFlow = chatbot.flows.find((flow) => flow.isActive) ?? chatbot.flows[0];
    if (!activeFlow) {
      throw badRequest("Save a valid flow before testing.");
    }

    const result = this.executeGraph(graphFromJson(activeFlow.graph), input.message);

    return {
      chatbot: serializeChatbot(chatbot),
      flow: serializeFlow(activeFlow),
      customer: {
        name: input.customerName ?? "Fake Customer",
        phone: input.customerPhone ?? "+15550000001"
      },
      result
    };
  }

  async executePublishedFlow(tenantId: string, message: string): Promise<RuntimeResult> {
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        tenantId,
        status: "ACTIVE",
        deletedAt: null,
        flows: {
          some: {
            isActive: true,
            deletedAt: null
          }
        }
      },
      include: {
        flows: {
          where: {
            isActive: true,
            deletedAt: null
          },
          orderBy: { version: "desc" }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    const activeFlow = chatbot?.flows[0];
    if (!activeFlow) {
      return { handled: false, replies: [], handover: false, reason: "no_active_flow", visitedNodeIds: [] };
    }

    return this.executeGraph(graphFromJson(activeFlow.graph), message);
  }

  private executeGraph(graph: ChatbotFlowGraph, message: string): RuntimeResult {
    const validation = validateGraph(graph);
    if (!validation.valid) {
      return {
        handled: false,
        replies: [],
        handover: false,
        reason: "invalid_flow",
        visitedNodeIds: []
      };
    }

    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const edgesBySource = new Map<string, FlowEdge[]>();
    for (const edge of graph.edges) {
      const existing = edgesBySource.get(edge.source) ?? [];
      existing.push(edge);
      edgesBySource.set(edge.source, existing);
    }

    const start = graph.nodes.find((node) => node.type === "start");
    const firstEdge = start ? (edgesBySource.get(start.id) ?? [])[0] : undefined;
    let current = firstEdge ? nodesById.get(firstEdge.target) : undefined;
    const replies: string[] = [];
    const visitedNodeIds: string[] = start ? [start.id] : [];
    let guard = 0;

    while (current && guard < 30) {
      guard += 1;
      visitedNodeIds.push(current.id);

      if (current.type === "human_handover") {
        const reply = textValue(current.data.message, "I am handing this to a team member now.");
        replies.push(reply);
        return { handled: true, replies, handover: true, reason: "human_handover", visitedNodeIds };
      }

      const reply = nodeReply(current);
      if (reply) {
        replies.push(reply);
      }

      if (current.type === "question" || current.type === "collect_info") {
        return { handled: replies.length > 0, replies, handover: false, reason: "waiting_for_customer", visitedNodeIds };
      }

      if (current.type === "api_webhook") {
        return { handled: replies.length > 0, replies, handover: true, reason: "webhook_placeholder", visitedNodeIds };
      }

      if (current.type === "end") {
        return { handled: replies.length > 0, replies, handover: false, reason: "ended", visitedNodeIds };
      }

      const nextEdge = findNextEdge(edgesBySource.get(current.id) ?? [], current, message);
      current = nextEdge ? nodesById.get(nextEdge.target) : undefined;
    }

    return {
      handled: replies.length > 0,
      replies,
      handover: false,
      reason: guard >= 30 ? "max_steps_reached" : "completed",
      visitedNodeIds
    };
  }

  private async findChatbot(tenantId: string, id: string) {
    const chatbot = await prisma.chatbot.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        flows: {
          where: { deletedAt: null },
          orderBy: { version: "desc" }
        }
      }
    });

    if (!chatbot) {
      throw notFound("Chatbot not found");
    }

    return chatbot;
  }

  private async assertChatbotExists(tenantId: string, id: string) {
    const chatbot = await prisma.chatbot.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true }
    });

    if (!chatbot) {
      throw notFound("Chatbot not found");
    }
  }
}

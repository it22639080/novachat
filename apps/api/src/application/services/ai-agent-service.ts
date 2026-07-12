import { Prisma, prisma } from "@novachat/database";
import type {
  AiAgentInput,
  AiAgentListQuery,
  AiAgentTestInput,
  AiAgentUpdateInput,
  AiAgentVersionInput
} from "@novachat/shared-types";
import type { AiChatMessage, AiProviderClient } from "../ai/ai-provider.js";
import { GeminiPlaceholderProvider } from "../../infrastructure/ai/gemini-provider.js";
import { OpenAiProvider, OpenAiProviderError } from "../../infrastructure/ai/openai-provider.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { badGateway, badRequest, notFound, serviceUnavailable } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { KnowledgeService } from "./knowledge-service.js";
import { UsageService } from "./usage-service.js";

const openAiProvider = new OpenAiProvider();
const geminiProvider = new GeminiPlaceholderProvider();
const knowledgeService = new KnowledgeService();
const usageService = new UsageService();
const defaultModel = "gpt-4o-mini";

const agentTemplates = [
  {
    key: "sales-assistant",
    name: "Sales Assistant",
    description: "Qualifies buyers, recommends offers, and prepares warm handovers.",
    personality: "consultative",
    tone: "friendly",
    toolPermissions: ["search_products", "create_draft_order"],
    allowedActions: ["answer_questions", "recommend_products", "capture_lead"],
    systemPrompt:
      "You are a consultative sales assistant. Help customers choose the right product or service, ask concise qualifying questions, and never overpromise."
  },
  {
    key: "support-assistant",
    name: "Support Assistant",
    description: "Answers policy, troubleshooting, and account questions from approved knowledge.",
    personality: "calm",
    tone: "professional",
    toolPermissions: ["search_knowledge", "handover_to_human"],
    allowedActions: ["answer_questions", "summarize_issue", "handover_to_human"],
    systemPrompt:
      "You are a support assistant. Resolve customer issues using approved knowledge, ask for missing details, and escalate when confidence is low."
  },
  {
    key: "appointment-assistant",
    name: "Appointment Assistant",
    description: "Collects booking details and checks appointment availability.",
    personality: "organized",
    tone: "warm",
    toolPermissions: ["check_available_slots", "book_appointment", "reschedule_appointment"],
    allowedActions: ["collect_customer_info", "check_availability", "book_after_confirmation"],
    systemPrompt:
      "You are an appointment assistant. Confirm date, time, customer name, and contact number before booking. Never double book unavailable slots."
  },
  {
    key: "order-assistant",
    name: "Order Assistant",
    description: "Finds products, drafts orders, and confirms order details.",
    personality: "precise",
    tone: "professional",
    toolPermissions: ["search_products", "check_product_availability", "create_draft_order", "confirm_order"],
    allowedActions: ["search_products", "create_draft_order", "confirm_after_customer_approval"],
    systemPrompt:
      "You are an order assistant. Create draft orders first and only confirm after explicit customer approval."
  },
  {
    key: "clinic-assistant",
    name: "Clinic Assistant",
    description: "Handles clinic questions, intake details, and appointment routing.",
    personality: "empathetic",
    tone: "warm",
    toolPermissions: ["check_available_slots", "book_appointment", "handover_to_human"],
    allowedActions: ["answer_general_questions", "collect_intake", "book_after_confirmation"],
    systemPrompt:
      "You are a clinic assistant. Provide general information only, avoid medical diagnosis, and route urgent or clinical questions to staff."
  }
] as const;

type AgentRecord = Prisma.AiAgentGetPayload<{
  include: {
    assignedWhatsappAccount: { select: { id: true; displayName: true; displayPhoneNumber: true; status: true } };
    assignedChatbot: { select: { id: true; name: true; status: true } };
    versions: { where: { deletedAt: null }; orderBy: { version: "desc" }; take: 5 };
  };
}>;

function normalizeModel(modelName: string | null | undefined) {
  const normalized = modelName?.trim();
  return normalized && normalized !== "gpt-4.0-mini" && normalized !== "gpt-4.1-mini" ? normalized : defaultModel;
}

function providerFor(provider: "OPENAI" | "GEMINI"): AiProviderClient {
  return provider === "OPENAI" ? openAiProvider : geminiProvider;
}

function serializeAgent(agent: AgentRecord) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    templateKey: agent.templateKey,
    status: agent.status,
    provider: agent.provider,
    modelName: agent.modelName,
    temperature: Number(agent.temperature),
    personality: agent.personality,
    tone: agent.tone,
    supportedLanguages: agent.supportedLanguages,
    systemPrompt: agent.systemPrompt,
    customPrompt: agent.customPrompt,
    toolPermissions: agent.toolPermissions,
    allowedActions: agent.allowedActions,
    handoverRules: agent.handoverRules,
    knowledgeDocumentIds: agent.knowledgeDocumentIds,
    assignedWhatsappAccount: agent.assignedWhatsappAccount,
    assignedChatbot: agent.assignedChatbot,
    activeVersion: agent.activeVersion,
    lastTestedAt: agent.lastTestedAt?.toISOString() ?? null,
    publishedAt: agent.publishedAt?.toISOString() ?? null,
    versions: agent.versions.map((version) => ({
      id: version.id,
      version: version.version,
      changelog: version.changelog,
      createdAt: version.createdAt.toISOString()
    })),
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString()
  };
}

function snapshotAgent(agent: {
  name: string;
  description: string | null;
  templateKey: string | null;
  provider: "OPENAI" | "GEMINI";
  modelName: string;
  temperature: Prisma.Decimal;
  personality: string;
  tone: string;
  supportedLanguages: string[];
  systemPrompt: string;
  customPrompt: string | null;
  toolPermissions: string[];
  allowedActions: string[];
  handoverRules: string[];
  knowledgeDocumentIds: string[];
  assignedWhatsappAccountId: string | null;
  assignedChatbotId: string | null;
}) {
  return {
    name: agent.name,
    description: agent.description,
    templateKey: agent.templateKey,
    provider: agent.provider,
    modelName: agent.modelName,
    temperature: Number(agent.temperature),
    personality: agent.personality,
    tone: agent.tone,
    supportedLanguages: agent.supportedLanguages,
    systemPrompt: agent.systemPrompt,
    customPrompt: agent.customPrompt,
    toolPermissions: agent.toolPermissions,
    allowedActions: agent.allowedActions,
    handoverRules: agent.handoverRules,
    knowledgeDocumentIds: agent.knowledgeDocumentIds,
    assignedWhatsappAccountId: agent.assignedWhatsappAccountId,
    assignedChatbotId: agent.assignedChatbotId
  };
}

function openAiAppError(error: OpenAiProviderError) {
  if (!error.status) {
    return serviceUnavailable("OPENAI_API_KEY_MISSING", "OPENAI_API_KEY is missing in backend .env file.");
  }
  if (error.status === 401) {
    return serviceUnavailable("OPENAI_INVALID_API_KEY", "Invalid OpenAI API key. Please check backend .env.");
  }
  if (error.status === 404) {
    return badGateway("OPENAI_MODEL_NOT_FOUND", "OpenAI model not found. Select gpt-4o-mini and save the agent.");
  }
  if (error.status === 429) {
    return serviceUnavailable("OPENAI_QUOTA_OR_RATE_LIMIT", "OpenAI quota or rate limit error. Check billing credits or try later.");
  }
  return badGateway("OPENAI_PROVIDER_ERROR", error.message);
}

export class AiAgentService {
  templates() {
    return agentTemplates;
  }

  async list(tenantId: string, query: AiAgentListQuery) {
    const pagination = createPagination(query);
    const where: Prisma.AiAgentWhereInput = { tenantId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.templateKey) where.templateKey = query.templateKey;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } }
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.aiAgent.findMany({
        where,
        include: {
          assignedWhatsappAccount: { select: { id: true, displayName: true, displayPhoneNumber: true, status: true } },
          assignedChatbot: { select: { id: true, name: true, status: true } },
          versions: { where: { deletedAt: null }, orderBy: { version: "desc" }, take: 5 }
        },
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.aiAgent.count({ where })
    ]);

    return { items: items.map(serializeAgent), pagination: pagination.meta(total) };
  }

  async get(tenantId: string, id: string) {
    const agent = await this.findAgent(tenantId, id);
    return serializeAgent(agent);
  }

  async create(tenantId: string, input: AiAgentInput, actorUserId?: string | null) {
    await this.validateAssignments(tenantId, input);
    const modelName = normalizeModel(input.modelName);

    const agent = await prisma.$transaction(async (tx) => {
      const created = await tx.aiAgent.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description ?? null,
          templateKey: input.templateKey ?? null,
          provider: input.provider,
          modelName,
          temperature: new Prisma.Decimal(input.temperature),
          personality: input.personality,
          tone: input.tone,
          supportedLanguages: input.supportedLanguages,
          systemPrompt: input.systemPrompt,
          customPrompt: input.customPrompt ?? null,
          toolPermissions: input.toolPermissions,
          allowedActions: input.allowedActions,
          handoverRules: input.handoverRules,
          knowledgeDocumentIds: input.knowledgeDocumentIds,
          assignedWhatsappAccountId: input.assignedWhatsappAccountId ?? null,
          assignedChatbotId: input.assignedChatbotId ?? null
        }
      });

      await tx.aiAgentVersion.create({
        data: {
          tenantId,
          aiAgentId: created.id,
          version: 1,
          snapshot: snapshotAgent(created) as Prisma.InputJsonValue,
          changelog: "Initial agent version",
          createdByUserId: actorUserId ?? null
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actorUserId ?? null,
          action: "ai_agent.create",
          entityType: "AiAgent",
          entityId: created.id,
          metadata: { name: created.name, templateKey: created.templateKey }
        }
      });

      return created;
    });

    return this.get(tenantId, agent.id);
  }

  async update(tenantId: string, id: string, input: AiAgentUpdateInput, actorUserId?: string | null) {
    await this.ensureAgentExists(tenantId, id);
    await this.validateAssignments(tenantId, input);

    const updated = await prisma.aiAgent.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.templateKey !== undefined ? { templateKey: input.templateKey ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        ...(input.modelName !== undefined ? { modelName: normalizeModel(input.modelName) } : {}),
        ...(input.temperature !== undefined ? { temperature: new Prisma.Decimal(input.temperature) } : {}),
        ...(input.personality !== undefined ? { personality: input.personality } : {}),
        ...(input.tone !== undefined ? { tone: input.tone } : {}),
        ...(input.supportedLanguages !== undefined ? { supportedLanguages: input.supportedLanguages } : {}),
        ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
        ...(input.customPrompt !== undefined ? { customPrompt: input.customPrompt ?? null } : {}),
        ...(input.toolPermissions !== undefined ? { toolPermissions: input.toolPermissions } : {}),
        ...(input.allowedActions !== undefined ? { allowedActions: input.allowedActions } : {}),
        ...(input.handoverRules !== undefined ? { handoverRules: input.handoverRules } : {}),
        ...(input.knowledgeDocumentIds !== undefined ? { knowledgeDocumentIds: input.knowledgeDocumentIds } : {}),
        ...(input.assignedWhatsappAccountId !== undefined ? { assignedWhatsappAccountId: input.assignedWhatsappAccountId ?? null } : {}),
        ...(input.assignedChatbotId !== undefined ? { assignedChatbotId: input.assignedChatbotId ?? null } : {})
      }
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: actorUserId ?? null,
        action: "ai_agent.update",
        entityType: "AiAgent",
        entityId: updated.id,
        metadata: { status: updated.status }
      }
    });

    return this.get(tenantId, id);
  }

  async delete(tenantId: string, id: string, actorUserId?: string | null) {
    await this.ensureAgentExists(tenantId, id);
    await prisma.$transaction([
      prisma.aiAgent.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          tenantId,
          actorUserId: actorUserId ?? null,
          action: "ai_agent.archive",
          entityType: "AiAgent",
          entityId: id
        }
      })
    ]);
    return { id, deleted: true };
  }

  async createVersion(tenantId: string, id: string, input: AiAgentVersionInput, actorUserId?: string | null) {
    const agent = await this.ensureAgentExists(tenantId, id);
    const latest = await prisma.aiAgentVersion.findFirst({
      where: { tenantId, aiAgentId: id, deletedAt: null },
      orderBy: { version: "desc" }
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const version = await prisma.$transaction(async (tx) => {
      const created = await tx.aiAgentVersion.create({
        data: {
          tenantId,
          aiAgentId: id,
          version: nextVersion,
          snapshot: snapshotAgent(agent) as Prisma.InputJsonValue,
          changelog: input.changelog ?? null,
          createdByUserId: actorUserId ?? null
        }
      });
      await tx.aiAgent.update({ where: { id }, data: { activeVersion: nextVersion } });
      return created;
    });

    return {
      id: version.id,
      version: version.version,
      changelog: version.changelog,
      createdAt: version.createdAt.toISOString()
    };
  }

  async versions(tenantId: string, id: string) {
    await this.ensureAgentExists(tenantId, id);
    const versions = await prisma.aiAgentVersion.findMany({
      where: { tenantId, aiAgentId: id, deletedAt: null },
      orderBy: { version: "desc" }
    });
    return versions.map((version) => ({
      id: version.id,
      version: version.version,
      snapshot: version.snapshot,
      changelog: version.changelog,
      createdByUserId: version.createdByUserId,
      createdAt: version.createdAt.toISOString()
    }));
  }

  async setStatus(tenantId: string, id: string, status: "ACTIVE" | "INACTIVE", actorUserId?: string | null) {
    await this.ensureAgentExists(tenantId, id);
    const agent = await prisma.aiAgent.update({
      where: { id },
      data: {
        status,
        ...(status === "ACTIVE" ? { publishedAt: new Date() } : {})
      }
    });
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: actorUserId ?? null,
        action: status === "ACTIVE" ? "ai_agent.activate" : "ai_agent.deactivate",
        entityType: "AiAgent",
        entityId: id
      }
    });
    return this.get(tenantId, agent.id);
  }

  async test(tenantId: string, id: string, input: AiAgentTestInput) {
    const startedAt = Date.now();
    const agent = await this.ensureAgentExists(tenantId, id);
    const reservation = await usageService.reserveAiReply(tenantId);
    const modelName = normalizeModel(agent.modelName || reservation.modelName);
    const messages = await this.buildMessages(tenantId, agent, input);

    logger.info({ tenantId, agentId: id, provider: agent.provider, modelName }, "Calling AI provider for agent test");

    try {
      const result = await providerFor(agent.provider).generateReply({
        model: modelName,
        temperature: Number(agent.temperature),
        messages
      });
      await usageService.recordAiUsage({
        tenantId,
        modelName,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
        fallbackUsed: false
      });
      await prisma.$transaction([
        prisma.aiAgent.update({ where: { id }, data: { lastTestedAt: new Date() } }),
        prisma.aiLog.create({
          data: {
            tenantId,
            provider: agent.provider,
            modelName,
            promptTokens: result.promptTokens,
            outputTokens: result.outputTokens,
            status: "SUCCESS",
            latencyMs: Date.now() - startedAt,
            metadata: { agentId: id, agentName: agent.name, source: "agent_test" }
          } as Prisma.AiLogUncheckedCreateInput
        })
      ]);
      return { reply: result.text, confidence: result.confidence, modelName, promptTokens: result.promptTokens, outputTokens: result.outputTokens };
    } catch (error) {
      await usageService.releaseAiReplyReservation(tenantId, reservation);
      const message = error instanceof Error ? error.message : "AI agent test failed";
      await prisma.aiLog.create({
        data: {
          tenantId,
          provider: agent.provider,
          modelName,
          promptTokens: 0,
          outputTokens: 0,
          status: "FAILED",
          latencyMs: Date.now() - startedAt,
          error: message,
          metadata: { agentId: id, agentName: agent.name, source: "agent_test" }
        } as Prisma.AiLogUncheckedCreateInput
      });

      if (error instanceof OpenAiProviderError) {
        throw openAiAppError(error);
      }
      throw badGateway("AI_AGENT_TEST_FAILED", message);
    }
  }

  private async buildMessages(tenantId: string, agent: Awaited<ReturnType<AiAgentService["ensureAgentExists"]>>, input: AiAgentTestInput): Promise<AiChatMessage[]> {
    const allChunks = await knowledgeService.semanticSearch(tenantId, input.message, 6).catch(() => []);
    const selectedDocumentIds = new Set(agent.knowledgeDocumentIds);
    const chunks = selectedDocumentIds.size
      ? allChunks.filter((chunk) => selectedDocumentIds.has(chunk.documentId))
      : allChunks;
    const knowledge = chunks
      .slice(0, 4)
      .map((chunk, index) => `Source ${index + 1}: ${chunk.sourceTitle ?? "Knowledge"}\n${chunk.content}`)
      .join("\n\n");

    return [
      {
        role: "system",
        content: [
          agent.systemPrompt,
          `Personality: ${agent.personality}`,
          `Tone: ${agent.tone}`,
          `Supported languages: ${agent.supportedLanguages.join(", ")}`,
          agent.customPrompt ? `Custom instructions:\n${agent.customPrompt}` : "",
          agent.toolPermissions.length ? `Allowed tools: ${agent.toolPermissions.join(", ")}` : "",
          agent.allowedActions.length ? `Allowed actions: ${agent.allowedActions.join(", ")}` : "",
          agent.handoverRules.length ? `Handover rules: ${agent.handoverRules.join("; ")}` : "",
          knowledge ? `Approved knowledge:\n${knowledge}` : "No approved knowledge was retrieved for this test."
        ]
          .filter(Boolean)
          .join("\n\n")
      },
      {
        role: "user",
        content: [
          `Customer name: ${input.customerName ?? "Test customer"}`,
          `Customer phone: ${input.customerPhone ?? "Not provided"}`,
          `Customer message: ${input.message}`
        ].join("\n")
      }
    ];
  }

  private async findAgent(tenantId: string, id: string) {
    const agent = await prisma.aiAgent.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: {
        assignedWhatsappAccount: { select: { id: true, displayName: true, displayPhoneNumber: true, status: true } },
        assignedChatbot: { select: { id: true, name: true, status: true } },
        versions: { where: { deletedAt: null }, orderBy: { version: "desc" }, take: 5 }
      }
    });
    if (!agent) throw notFound("AI agent not found");
    return agent;
  }

  private async ensureAgentExists(tenantId: string, id: string) {
    const agent = await prisma.aiAgent.findFirst({ where: { tenantId, id, deletedAt: null } });
    if (!agent) throw notFound("AI agent not found");
    return agent;
  }

  private async validateAssignments(
    tenantId: string,
    input: {
      assignedWhatsappAccountId?: string | null | undefined;
      assignedChatbotId?: string | null | undefined;
      knowledgeDocumentIds?: string[] | undefined;
    }
  ) {
    if (input.assignedWhatsappAccountId) {
      const account = await prisma.whatsAppAccount.findFirst({
        where: { id: input.assignedWhatsappAccountId, tenantId, deletedAt: null }
      });
      if (!account) throw badRequest("Selected WhatsApp account does not belong to this tenant.");
    }

    if (input.assignedChatbotId) {
      const chatbot = await prisma.chatbot.findFirst({
        where: { id: input.assignedChatbotId, tenantId, deletedAt: null }
      });
      if (!chatbot) throw badRequest("Selected chatbot does not belong to this tenant.");
    }

    if (input.knowledgeDocumentIds?.length) {
      const documents = await prisma.knowledgeBaseDocument.findMany({
        where: { tenantId, id: { in: input.knowledgeDocumentIds }, deletedAt: null },
        select: { id: true }
      });
      if (documents.length !== input.knowledgeDocumentIds.length) {
        throw badRequest("One or more selected knowledge documents do not belong to this tenant.");
      }
    }
  }
}

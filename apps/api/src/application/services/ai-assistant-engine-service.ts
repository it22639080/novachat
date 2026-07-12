import { Prisma, prisma } from "@novachat/database";
import type {
  AiLogsQuery,
  AiTestReplyInput,
  ConversationAiToggleInput,
  UpdateAiSettingsInput
} from "@novachat/shared-types";
import { OpenAiProvider } from "../../infrastructure/ai/openai-provider.js";
import { GeminiPlaceholderProvider } from "../../infrastructure/ai/gemini-provider.js";
import type { AiChatMessage, AiProviderClient } from "../ai/ai-provider.js";
import { buildSystemPrompt, buildUserPrompt } from "../ai/prompt-builder.js";
import { MessageProcessingService } from "./message-processing-service.js";
import { KnowledgeService } from "./knowledge-service.js";
import { ChatbotService } from "./chatbot-service.js";
import { WhatsAppCloudClient } from "../../infrastructure/whatsapp/whatsapp-cloud-client.js";
import { decryptSecret } from "../../infrastructure/crypto/secret-crypto.js";
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { OpenAiProviderError } from "../../infrastructure/ai/openai-provider.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { AppError, badGateway, notFound, serviceUnavailable } from "../../shared/errors/app-error.js";
import { UsageService } from "./usage-service.js";

type IncomingAiParams = {
  tenantId: string;
  conversationId: string;
  source: "simulator" | "whatsapp";
};

const openAiProvider = new OpenAiProvider();
const geminiProvider = new GeminiPlaceholderProvider();
const messageProcessingService = new MessageProcessingService();
const whatsappCloudClient = new WhatsAppCloudClient();
const knowledgeService = new KnowledgeService();
const usageService = new UsageService();
const chatbotService = new ChatbotService();
const defaultAiModel = "gpt-4o-mini";
const invalidModelAliases: Record<string, string> = {
  "gpt-4.0-mini": defaultAiModel,
  "gpt-4.1-mini": defaultAiModel
};

function normalizeModelName(modelName: string | null | undefined) {
  const normalized = modelName?.trim();
  if (!normalized) {
    return defaultAiModel;
  }

  return invalidModelAliases[normalized] ?? normalized;
}

function serializeSettings(settings: TenantAiSettingsRecord) {
  return {
    id: settings.id,
    isEnabled: settings.isEnabled,
    provider: settings.provider,
    modelName: settings.modelName,
    temperature: Number(settings.temperature),
    businessName: settings.businessName,
    businessDescription: settings.businessDescription,
    tone: settings.tone,
    supportedLanguages: settings.supportedLanguages,
    openingHours: settings.openingHours,
    services: settings.services,
    policies: settings.policies,
    fallbackMessage: settings.fallbackMessage,
    handoverKeywords: settings.handoverKeywords,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString()
  };
}

type TenantAiSettingsRecord = Prisma.TenantAiSettingsGetPayload<Record<string, never>>;

function providerFor(provider: "OPENAI" | "GEMINI"): AiProviderClient {
  return provider === "OPENAI" ? openAiProvider : geminiProvider;
}

function messageLength(messages: AiChatMessage[]) {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

function openAiLogMessage(error: OpenAiProviderError, modelName: string) {
  if (!error.status) {
    return "OPENAI_API_KEY missing";
  }

  if (error.status === 401) {
    return "OpenAI invalid API key";
  }

  if (error.status === 404) {
    return `OpenAI model not found: ${modelName}`;
  }

  if (error.status === 429) {
    return "OpenAI quota or rate limit error: 429";
  }

  return error.message;
}

function openAiAppError(error: OpenAiProviderError, modelName: string) {
  if (!error.status) {
    return serviceUnavailable(
      "OPENAI_API_KEY_MISSING",
      "OPENAI_API_KEY is missing in backend .env file."
    );
  }

  if (error.status === 401) {
    return serviceUnavailable(
      "OPENAI_INVALID_API_KEY",
      "Invalid OpenAI API key. Please check OPENAI_API_KEY in backend .env."
    );
  }

  if (error.status === 404) {
    return badGateway(
      "OPENAI_MODEL_NOT_FOUND",
      "OpenAI model not found. Please select gpt-4o-mini and save settings again.",
      { modelName }
    );
  }

  if (error.status === 429) {
    return serviceUnavailable(
      "OPENAI_QUOTA_OR_RATE_LIMIT",
      "OpenAI quota or rate limit error. Please check billing credits, quota, or try again later."
    );
  }

  return badGateway("OPENAI_PROVIDER_ERROR", error.message);
}

function containsHandoverKeyword(message: string, keywords: string[]) {
  const normalized = message.toLowerCase();
  return keywords.some((keyword) => keyword && normalized.includes(keyword.toLowerCase()));
}

function mapLog(log: Prisma.AiLogGetPayload<{ include: { conversation: { select: { id: true; subject: true } } } }>) {
  return {
    id: log.id,
    provider: log.provider,
    modelName: log.modelName,
    promptTokens: log.promptTokens,
    outputTokens: log.outputTokens,
    status: log.status,
    latencyMs: log.latencyMs,
    error: log.error,
    conversation: log.conversation,
    createdAt: log.createdAt.toISOString()
  };
}

export class AiAssistantEngineService {
  async getSettings(tenantId: string) {
    const settings = await this.ensureSettings(tenantId);
    return serializeSettings(settings);
  }

  async updateSettings(tenantId: string, input: UpdateAiSettingsInput) {
    const existing = await this.ensureSettings(tenantId);
    const modelName = input.modelName ? normalizeModelName(input.modelName) : undefined;
    const settings = await prisma.tenantAiSettings.update({
      where: { id: existing.id },
      data: {
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.provider ? { provider: input.provider } : {}),
        ...(modelName ? { modelName } : {}),
        ...(input.temperature !== undefined
          ? { temperature: new Prisma.Decimal(input.temperature) }
          : {}),
        ...(input.businessName !== undefined ? { businessName: input.businessName ?? null } : {}),
        ...(input.businessDescription !== undefined
          ? { businessDescription: input.businessDescription ?? null }
          : {}),
        ...(input.tone ? { tone: input.tone } : {}),
        ...(input.supportedLanguages ? { supportedLanguages: input.supportedLanguages } : {}),
        ...(input.openingHours ? { openingHours: input.openingHours as Prisma.InputJsonValue } : {}),
        ...(input.services ? { services: input.services } : {}),
        ...(input.policies ? { policies: input.policies } : {}),
        ...(input.fallbackMessage ? { fallbackMessage: input.fallbackMessage } : {}),
        ...(input.handoverKeywords ? { handoverKeywords: input.handoverKeywords } : {})
      }
    });

    if (modelName) {
      await prisma.tenantUsageLimit.upsert({
        where: { tenantId },
        update: { currentAiModel: modelName },
        create: { tenantId, currentAiModel: modelName }
      });
    }

    return serializeSettings(settings);
  }

  async testReply(tenantId: string, input: AiTestReplyInput) {
    const startedAt = Date.now();
    const settings = await this.ensureSettings(tenantId);
    const messages = this.buildMessages(settings, {
      customerSummary: [
        `Customer name: ${input.customerName ?? "Test customer"}`,
        `Customer phone: ${input.customerPhone ?? "Not provided"}`
      ].join("\n"),
      recentMessages: [],
      latestCustomerMessage: input.message,
      knowledgeChunks: await this.retrieveKnowledgeContext(tenantId, input.message)
    });

    const result = await this.generateOrFallback(settings, messages, startedAt, {
      tenantId,
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      fallbackOnError: false
    });

    return {
      reply: result.text,
      confidence: result.confidence,
      fallbackUsed: result.fallbackUsed
    };
  }

  async listLogs(tenantId: string, query: AiLogsQuery) {
    const pagination = createPagination(query);
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.conversationId ? { conversationId: query.conversationId } : {}),
      ...(query.search
        ? {
            OR: [
              { error: { contains: query.search, mode: "insensitive" as const } },
              { modelName: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [items, total] = await prisma.$transaction([
      prisma.aiLog.findMany({
        where,
        include: { conversation: { select: { id: true, subject: true } } },
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.aiLog.count({ where })
    ]);

    return {
      items: items.map(mapLog),
      pagination: pagination.meta(total)
    };
  }

  async toggleConversation(tenantId: string, conversationId: string, input: ConversationAiToggleInput) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, deletedAt: null }
    });

    if (!conversation) {
      throw notFound("Conversation not found");
    }

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        ...(input.aiEnabled !== undefined ? { aiEnabled: input.aiEnabled } : {}),
        ...(input.humanHandover !== undefined ? { humanHandover: input.humanHandover } : {})
      },
      select: {
        id: true,
        aiEnabled: true,
        humanHandover: true
      }
    });

    return updated;
  }

  async handleIncomingMessage(params: IncomingAiParams) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.conversationId,
        tenantId: params.tenantId,
        deletedAt: null
      },
      include: {
        customer: true,
        whatsappAccount: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 12
        }
      }
    });

    if (!conversation) {
      throw notFound("Conversation not found");
    }

    if (!conversation.aiEnabled) {
      return { skipped: true, reason: "conversation_ai_disabled" };
    }

    const settings = await this.ensureSettings(params.tenantId);

    if (conversation.humanHandover) {
      await this.logBlocked(params.tenantId, conversation.id, settings, "Human handover is active");
      return { skipped: true, reason: "human_handover_active" };
    }

    const latestInbound = conversation.messages.find((message) => message.direction === "INBOUND");
    const latestText = latestInbound?.text ?? "";

    if (containsHandoverKeyword(latestText, settings.handoverKeywords)) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { humanHandover: true, status: "PENDING" }
      });
      await this.logBlocked(params.tenantId, conversation.id, settings, "Handover keyword detected");
      return { skipped: true, reason: "handover_keyword_detected" };
    }

    const flowResult = await chatbotService.executePublishedFlow(params.tenantId, latestText);
    if (flowResult.handled && flowResult.replies.length > 0) {
      if (flowResult.handover) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { humanHandover: true, status: "PENDING" }
        });
      }

      const reply = await this.sendAiReply({
        tenantId: params.tenantId,
        conversationId: conversation.id,
        source: params.source,
        text: flowResult.replies.join("\n\n"),
        whatsappAccountId: conversation.whatsappAccountId,
        customerPhone: conversation.customer.phone
      });

      return {
        skipped: false,
        source: "chatbot_flow",
        flow: flowResult,
        reply
      };
    }

    if (!settings.isEnabled) {
      return { skipped: true, reason: "tenant_ai_disabled" };
    }

    const messages = this.buildMessages(settings, {
      customerSummary: [
        `Customer name: ${conversation.customer.name ?? "Unknown"}`,
        `Customer phone: ${conversation.customer.phone}`,
        `Customer email: ${conversation.customer.email ?? "Unknown"}`,
        `Customer status: ${conversation.customer.status}`
      ].join("\n"),
      recentMessages: conversation.messages
        .slice()
        .reverse()
        .map((message) => ({
          direction: message.direction,
          senderType: message.senderType,
          text: message.text
        })),
      latestCustomerMessage: latestText,
      knowledgeChunks: await this.retrieveKnowledgeContext(params.tenantId, latestText)
    });

    const startedAt = Date.now();
    let generated: Awaited<ReturnType<AiAssistantEngineService["generateOrFallback"]>>;
    try {
      generated = await this.generateOrFallback(settings, messages, startedAt, {
        tenantId: params.tenantId,
        conversationId: conversation.id
      });
    } catch (error) {
      if (error instanceof AppError && error.code.includes("LIMIT")) {
        await this.markHumanHandoverForLimit(params.tenantId, conversation.id, settings, error.message);
        return { skipped: true, reason: error.code.toLowerCase() };
      }

      throw error;
    }

    const reply = await this.sendAiReply({
      tenantId: params.tenantId,
      conversationId: conversation.id,
      source: params.source,
      text: generated.text,
      whatsappAccountId: conversation.whatsappAccountId,
      customerPhone: conversation.customer.phone
    });

    return {
      skipped: false,
      reply
    };
  }

  private async sendAiReply(input: {
    tenantId: string;
    conversationId: string;
    source: "simulator" | "whatsapp";
    text: string;
    whatsappAccountId: string | null;
    customerPhone: string;
  }) {
    if (input.source === "simulator") {
      return messageProcessingService.processOutgoing({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        source: "simulator",
        senderType: "AI",
        type: "text",
        text: input.text,
        status: "sent"
      });
    }

    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        tenantId: input.tenantId,
        ...(input.whatsappAccountId ? { id: input.whatsappAccountId } : {}),
        deletedAt: null
      }
    });

    if (!account?.encryptedAccessToken) {
      throw notFound("WhatsApp account or access token not found for AI reply");
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.customerPhone.replace(/[^\d+]/g, ""),
      type: "text",
      text: {
        preview_url: false,
        body: input.text
      }
    };
    const whatsappReservation = await usageService.reserveWhatsappMessage(input.tenantId);
    let response: Awaited<ReturnType<WhatsAppCloudClient["sendMessage"]>>;

    try {
      response = await whatsappCloudClient.sendMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken: decryptSecret(account.encryptedAccessToken),
        payload
      });
    } catch (error) {
      await usageService.releaseWhatsappReservation(input.tenantId, whatsappReservation);
      throw error;
    }
    const providerMessageId = response?.messages?.[0]?.id;
    await usageService.recordWhatsappMessage(input.tenantId, {
      source: "ai_reply",
      conversationId: input.conversationId,
      providerMessageId: providerMessageId ?? null
    });

    return messageProcessingService.processOutgoing({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      whatsappAccountId: account.id,
      source: "whatsapp",
      senderType: "AI",
      type: "text",
      text: input.text,
      status: "sent",
      ...(providerMessageId ? { externalId: providerMessageId } : {}),
      rawPayload: { request: payload, response }
    });
  }

  private buildMessages(
    settings: TenantAiSettingsRecord,
    context: Parameters<typeof buildUserPrompt>[0]
  ): AiChatMessage[] {
    return [
      {
        role: "system",
        content: buildSystemPrompt({
          businessName: settings.businessName,
          businessDescription: settings.businessDescription,
          tone: settings.tone,
          supportedLanguages: settings.supportedLanguages,
          openingHours: settings.openingHours,
          services: settings.services,
          policies: settings.policies,
          fallbackMessage: settings.fallbackMessage
        })
      },
      {
        role: "user",
        content: buildUserPrompt(context)
      }
    ];
  }

  private async generateOrFallback(
    settings: TenantAiSettingsRecord,
    messages: AiChatMessage[],
    startedAt: number,
    context: { tenantId: string; conversationId?: string; fallbackOnError?: boolean }
  ) {
    const reservation = await usageService.reserveAiReply(context.tenantId);
    const modelName = normalizeModelName(reservation.modelName);

    logger.info(
      {
        tenantId: context.tenantId,
        provider: settings.provider,
        modelName,
        baseUrl: env.OPENAI_BASE_URL,
        hasOpenAiKey: Boolean(env.OPENAI_API_KEY),
        messageLength: messageLength(messages)
      },
      "Calling OpenAI for AI reply"
    );

    try {
      const result = await providerFor(settings.provider).generateReply({
        model: modelName,
        temperature: Number(settings.temperature),
        messages
      });
      await usageService.recordAiUsage({
        tenantId: context.tenantId,
        modelName,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
        ...(context.conversationId ? { conversationId: context.conversationId } : {}),
        fallbackUsed: false
      });

      await prisma.aiLog.create({
        data: {
          tenantId: context.tenantId,
          conversationId: context.conversationId ?? null,
          provider: settings.provider,
          modelName,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
          status: "SUCCESS",
          latencyMs: Date.now() - startedAt,
          metadata: {
            confidence: result.confidence,
            fallbackUsed: false
          } as Prisma.InputJsonValue
        } as Prisma.AiLogUncheckedCreateInput
      });

      return { ...result, fallbackUsed: false };
    } catch (error) {
      await usageService.releaseAiReplyReservation(context.tenantId, reservation);
      const logError =
        error instanceof OpenAiProviderError ? openAiLogMessage(error, modelName) : error instanceof Error ? error.message : "AI provider failed";

      await prisma.aiLog.create({
        data: {
          tenantId: context.tenantId,
          conversationId: context.conversationId ?? null,
          provider: settings.provider,
          modelName,
          promptTokens: 0,
          outputTokens: 0,
          status: "FAILED",
          latencyMs: Date.now() - startedAt,
          error: logError,
          metadata: {
            fallbackUsed: true,
            providerStatus: error instanceof OpenAiProviderError ? error.status ?? null : null,
            providerCode: error instanceof OpenAiProviderError ? error.providerCode ?? null : null,
            providerType: error instanceof OpenAiProviderError ? error.providerType ?? null : null
          } as Prisma.InputJsonValue
        } as Prisma.AiLogUncheckedCreateInput
      });

      logger.error(
        {
          tenantId: context.tenantId,
          provider: settings.provider,
          modelName,
          error: logError,
          status: error instanceof OpenAiProviderError ? error.status : undefined,
          providerCode: error instanceof OpenAiProviderError ? error.providerCode : undefined,
          providerType: error instanceof OpenAiProviderError ? error.providerType : undefined,
          providerBody: error instanceof OpenAiProviderError ? error.responseBody : undefined
        },
        "AI provider generation failed"
      );

      if (context.fallbackOnError === false) {
        if (error instanceof OpenAiProviderError) {
          throw openAiAppError(error, modelName);
        }

        throw badGateway("AI_PROVIDER_ERROR", logError);
      }

      return {
        text: settings.fallbackMessage,
        promptTokens: 0,
        outputTokens: 0,
        confidence: 0.25,
        fallbackUsed: true
      };
    }
  }

  private async retrieveKnowledgeContext(tenantId: string, question: string) {
    if (!question.trim()) {
      return [];
    }

    try {
      const chunks = await knowledgeService.semanticSearch(tenantId, question, 4);
      return chunks.filter((chunk) => chunk.score >= 0.12);
    } catch (error) {
      logger.warn(
        {
          tenantId,
          err: error
        },
        "Knowledge retrieval skipped for AI reply"
      );
      return [];
    }
  }

  private async logBlocked(
    tenantId: string,
    conversationId: string,
    settings: TenantAiSettingsRecord,
    reason: string
  ) {
    const modelName = normalizeModelName(settings.modelName);
    await prisma.aiLog.create({
      data: {
        tenantId,
        conversationId,
        provider: settings.provider,
        modelName,
        promptTokens: 0,
        outputTokens: 0,
        status: "BLOCKED",
        error: reason
      }
    });
  }

  private async markHumanHandoverForLimit(
    tenantId: string,
    conversationId: string,
    settings: TenantAiSettingsRecord,
    reason: string
  ) {
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { humanHandover: true, status: "PENDING" }
      }),
      prisma.note.create({
        data: {
          tenantId,
          conversationId,
          body: `System note: AI disabled due to usage limit. ${reason}`
        }
      })
    ]);
    await this.logBlocked(tenantId, conversationId, settings, reason);
  }

  private async ensureSettings(tenantId: string) {
    const settings = await prisma.tenantAiSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId, modelName: defaultAiModel }
    });

    const normalizedModelName = normalizeModelName(settings.modelName);
    if (normalizedModelName !== settings.modelName) {
      return prisma.tenantAiSettings.update({
        where: { id: settings.id },
        data: { modelName: normalizedModelName }
      });
    }

    return settings;
  }
}

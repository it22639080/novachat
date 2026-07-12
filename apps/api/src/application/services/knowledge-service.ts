import { prisma, Prisma } from "@novachat/database";
import type {
  CreateKnowledgeDocumentInput,
  KnowledgeDocumentListQuery,
  KnowledgeTestAnswerInput,
  KnowledgeTestSearchInput
} from "@novachat/shared-types";
import { env } from "../../config/env.js";
import { OpenAiEmbeddingProvider } from "../../infrastructure/ai/openai-embedding-provider.js";
import { OpenAiProvider, OpenAiProviderError } from "../../infrastructure/ai/openai-provider.js";
import { knowledgeQueue } from "../../infrastructure/queue/queue.js";
import { BillingService } from "./billing-service.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { AppError, badGateway, badRequest, notFound, serviceUnavailable } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { buildSystemPrompt } from "../ai/prompt-builder.js";
import { checksum, cleanText, extractText, splitIntoChunks } from "../knowledge/text-processing.js";

type SearchRow = {
  id: string;
  documentId: string;
  content: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  position: number;
  distance: number;
};

const embeddingProvider = new OpenAiEmbeddingProvider();
const billingService = new BillingService();
const openAiProvider = new OpenAiProvider();

function jsonObject(value: Prisma.JsonValue | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Prisma.JsonValue>;
  }

  return {};
}

function vectorLiteral(embedding: number[]) {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function serializeDocument(document: {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  status: string;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { chunks: number };
}) {
  return {
    id: document.id,
    title: document.title,
    sourceType: document.sourceType,
    sourceUrl: document.sourceUrl,
    mimeType: document.mimeType,
    fileName: document.fileName,
    fileSize: document.fileSize,
    status: document.status,
    error: document.error,
    chunkCount: document._count?.chunks ?? 0,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
}

function serializeSearchRow(row: SearchRow) {
  return {
    id: row.id,
    documentId: row.documentId,
    content: row.content,
    sourceTitle: row.sourceTitle,
    sourceUrl: row.sourceUrl,
    position: row.position,
    score: Math.max(0, 1 - Number(row.distance))
  };
}

function mapOpenAiError(error: OpenAiProviderError) {
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

  if (error.status === 429) {
    return serviceUnavailable(
      "OPENAI_QUOTA_OR_RATE_LIMIT",
      "OpenAI quota or rate limit error. Please check billing credits, quota, or try again later."
    );
  }

  return badGateway("OPENAI_PROVIDER_ERROR", error.message);
}

export class KnowledgeService {
  async createDocument(tenantId: string, input: CreateKnowledgeDocumentInput) {
    const incomingMb = Math.ceil(
      Math.max(input.contentText?.length ?? 0, input.contentBase64 ? Math.ceil(input.contentBase64.length * 0.75) : 0) /
        (1024 * 1024)
    );
    await billingService.assertPlanAllowance(tenantId, "knowledgeBaseStorageMb", Math.max(1, incomingMb));

    if (input.sourceType === "URL" && !input.sourceUrl) {
      throw badRequest("sourceUrl is required for URL knowledge sources");
    }

    if (input.sourceType !== "URL" && !input.contentBase64 && !input.contentText) {
      throw badRequest("Document content is required for file uploads");
    }

    const fileBuffer = input.contentBase64 ? Buffer.from(input.contentBase64, "base64") : null;
    const document = await prisma.knowledgeBaseDocument.create({
      data: {
        tenantId,
        title: input.title,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl ?? null,
        mimeType: input.mimeType ?? null,
        fileName: input.fileName ?? null,
        fileSize: fileBuffer?.byteLength ?? input.contentText?.length ?? null,
        checksum: checksum(input.sourceUrl ?? input.contentBase64 ?? input.contentText ?? input.title),
        status: "UPLOADED",
        metadata: {
          contentBase64: input.contentBase64 ?? null,
          contentText: input.contentText ?? null
        } as Prisma.InputJsonValue
      },
      include: { _count: { select: { chunks: { where: { deletedAt: null } } } } }
    });

    await this.enqueueProcessing(document.id, tenantId);
    return serializeDocument(document);
  }

  async listDocuments(tenantId: string, query: KnowledgeDocumentListQuery) {
    const pagination = createPagination(query);
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" as const } },
              { sourceUrl: { contains: query.search, mode: "insensitive" as const } },
              { fileName: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.knowledgeBaseDocument.findMany({
        where,
        include: { _count: { select: { chunks: { where: { deletedAt: null } } } } },
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.knowledgeBaseDocument.count({ where })
    ]);

    return {
      items: items.map(serializeDocument),
      pagination: pagination.meta(total)
    };
  }

  async getDocument(tenantId: string, documentId: string) {
    const document = await prisma.knowledgeBaseDocument.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
      include: {
        _count: { select: { chunks: { where: { deletedAt: null } } } },
        chunks: {
          where: { deletedAt: null },
          orderBy: { position: "asc" },
          take: 20
        }
      }
    });

    if (!document) {
      throw notFound("Knowledge document not found");
    }

    return {
      ...serializeDocument(document),
      chunks: document.chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        position: chunk.position,
        tokenCount: chunk.tokenCount,
        sourceTitle: chunk.sourceTitle,
        sourceUrl: chunk.sourceUrl
      }))
    };
  }

  async deleteDocument(tenantId: string, documentId: string) {
    const document = await prisma.knowledgeBaseDocument.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
      select: { id: true }
    });

    if (!document) {
      throw notFound("Knowledge document not found");
    }

    await prisma.$transaction([
      prisma.knowledgeBaseChunk.updateMany({
        where: { tenantId, documentId },
        data: { deletedAt: new Date() }
      }),
      prisma.knowledgeBaseDocument.update({
        where: { id: document.id },
        data: { deletedAt: new Date() }
      })
    ]);

    return { deleted: true };
  }

  async reprocessDocument(tenantId: string, documentId: string) {
    const document = await prisma.knowledgeBaseDocument.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
      select: { id: true }
    });

    if (!document) {
      throw notFound("Knowledge document not found");
    }

    await prisma.knowledgeBaseDocument.update({
      where: { id: document.id },
      data: { status: "UPLOADED", error: null }
    });
    await this.enqueueProcessing(document.id, tenantId);

    return { queued: true };
  }

  async testSearch(tenantId: string, input: KnowledgeTestSearchInput) {
    try {
      const chunks = await this.semanticSearch(tenantId, input.query, input.topK);
      return { chunks };
    } catch (error) {
      if (error instanceof OpenAiProviderError) {
        throw mapOpenAiError(error);
      }

      throw error;
    }
  }

  async testAnswer(tenantId: string, input: KnowledgeTestAnswerInput) {
    let chunks: Awaited<ReturnType<KnowledgeService["semanticSearch"]>>;
    try {
      chunks = await this.semanticSearch(tenantId, input.query, input.topK);
    } catch (error) {
      if (error instanceof OpenAiProviderError) {
        throw mapOpenAiError(error);
      }

      throw error;
    }
    const context = chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join("\n\n");

    if (!chunks.length) {
      return {
        answer: "No relevant knowledge was found for this question.",
        chunks
      };
    }

    let result: Awaited<ReturnType<OpenAiProvider["generateReply"]>>;
    try {
      result = await openAiProvider.generateReply({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({
              businessName: "NovaChat tenant",
              businessDescription: "Answer only from the retrieved knowledge base context.",
              tone: "professional",
              supportedLanguages: ["English"],
              openingHours: null,
              services: [],
              policies: [],
              fallbackMessage: "I do not have enough knowledge base context to answer that."
            })
          },
          {
            role: "user",
            content: `Customer question: ${input.query}\n\nRetrieved knowledge:\n${context}\n\nAnswer with concise source-aware guidance.`
          }
        ]
      });
    } catch (error) {
      if (error instanceof OpenAiProviderError) {
        throw mapOpenAiError(error);
      }

      throw error;
    }

    return {
      answer: result.text,
      chunks
    };
  }

  async processDocument(documentId: string, tenantId: string) {
    const document = await prisma.knowledgeBaseDocument.findFirst({
      where: { id: documentId, tenantId, deletedAt: null }
    });

    if (!document) {
      logger.warn({ documentId, tenantId }, "Skipping stale knowledge job because document no longer exists");
      return;
    }

    await prisma.knowledgeBaseDocument.update({
      where: { id: document.id },
      data: { status: "PROCESSING", error: null }
    });

    try {
      logger.info({ documentId, tenantId, sourceType: document.sourceType, fileName: document.fileName }, "Extracting knowledge document text");
      const metadata = document.metadata as { contentBase64?: string | null; contentText?: string | null } | null;
      const sourceText =
        document.sourceType === "URL"
          ? await this.fetchUrlText(document.sourceUrl)
          : await extractText({
              title: document.title,
              mimeType: document.mimeType,
              fileName: document.fileName,
              ...(metadata?.contentBase64 ? { contentBase64: metadata.contentBase64 } : {}),
              ...(metadata?.contentText ? { contentText: metadata.contentText } : {})
            });

      const cleaned = cleanText(sourceText);
      logger.info({ documentId, tenantId, characters: cleaned.length }, "Knowledge document text extracted");
      if (document.sourceType === "URL" && cleaned.length < 120) {
        throw badRequest(
          "Website source did not expose enough readable text. This site may be JavaScript-rendered; add a text document or a page with server-rendered content."
        );
      }

      const chunks = splitIntoChunks(cleaned);
      logger.info({ documentId, tenantId, chunks: chunks.length }, "Knowledge document chunked");

      if (!chunks.length) {
        throw badRequest("No readable text was found in this knowledge source");
      }

      await prisma.$transaction([
        prisma.knowledgeBaseChunk.deleteMany({ where: { tenantId, documentId: document.id } }),
        prisma.knowledgeBaseDocument.update({
          where: { id: document.id },
          data: {
            content: cleaned.slice(0, 250_000),
            status: "PROCESSING",
            error: null,
            metadata: {
              ...jsonObject(document.metadata),
              sourceType: document.sourceType,
              processedAt: new Date().toISOString()
            } as Prisma.InputJsonValue
          }
        })
      ]);

      for (const chunk of chunks) {
        logger.info({ documentId, tenantId, position: chunk.position }, "Generating knowledge chunk embedding");
        const created = await prisma.knowledgeBaseChunk.create({
          data: {
            tenantId,
            documentId: document.id,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            position: chunk.position,
            sourceTitle: document.title,
            sourceUrl: document.sourceUrl,
            metadata: {
              embeddingModel: env.OPENAI_EMBEDDING_MODEL
            } as Prisma.InputJsonValue
          }
        });
        const { embedding } = await embeddingProvider.embed(chunk.content);
        await this.updateChunkEmbedding(created.id, embedding);
        logger.info({ documentId, tenantId, position: chunk.position }, "Knowledge chunk embedding stored");
      }

      await prisma.knowledgeBaseDocument.update({
        where: { id: document.id },
        data: { status: "COMPLETED", error: null }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Knowledge processing failed";
      await prisma.knowledgeBaseDocument.update({
        where: { id: document.id },
        data: { status: "FAILED", error: message }
      });

      if (error instanceof AppError) {
        logger.warn({ documentId, tenantId, error: message }, "Knowledge document processing failed with application error");
      }

      throw error;
    }
  }

  async semanticSearch(tenantId: string, query: string, topK = 5) {
    const { embedding } = await embeddingProvider.embed(query);
    const vector = vectorLiteral(embedding);
    const rows = await prisma.$queryRawUnsafe<SearchRow[]>(
      `
        SELECT
          c."id",
          c."documentId",
          c."content",
          c."sourceTitle",
          c."sourceUrl",
          c."position",
          (c."embedding" <=> $1::vector) AS "distance"
        FROM "KnowledgeBaseChunk" c
        INNER JOIN "KnowledgeBaseDocument" d ON d."id" = c."documentId"
        WHERE c."tenantId" = $2
          AND c."deletedAt" IS NULL
          AND c."embedding" IS NOT NULL
          AND d."deletedAt" IS NULL
          AND d."status" = 'COMPLETED'
        ORDER BY c."embedding" <=> $1::vector
        LIMIT $3
      `,
      vector,
      tenantId,
      topK
    );

    return rows.map(serializeSearchRow);
  }

  async enqueueProcessing(documentId: string, tenantId: string) {
    const job = await knowledgeQueue.add(
      "process-document",
      { documentId, tenantId },
      {
        jobId: `knowledge-${documentId}`,
        removeOnComplete: true,
        removeOnFail: true
      }
    );
    logger.info({ jobId: job.id, documentId, tenantId }, "Knowledge document queued for processing");
  }

  async enqueuePendingDocuments(limit = 100) {
    const pending = await prisma.knowledgeBaseDocument.findMany({
      where: {
        deletedAt: null,
        status: { in: ["UPLOADED", "PROCESSING"] }
      },
      select: { id: true, tenantId: true, status: true },
      orderBy: { updatedAt: "asc" },
      take: limit
    });

    let queued = 0;
    for (const document of pending) {
      try {
        await this.enqueueProcessing(document.id, document.tenantId);
        queued += 1;
      } catch (error) {
        logger.error(
          { documentId: document.id, tenantId: document.tenantId, err: error },
          "Failed to requeue pending knowledge document"
        );
      }
    }

    if (queued) {
      logger.info({ count: queued }, "Pending knowledge documents requeued on startup");
    }

    return { queued };
  }

  private async updateChunkEmbedding(chunkId: string, embedding: number[]) {
    await prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeBaseChunk" SET "embedding" = $1::vector, "updatedAt" = NOW() WHERE "id" = $2`,
      vectorLiteral(embedding),
      chunkId
    );
  }

  private async fetchUrlText(sourceUrl: string | null) {
    if (!sourceUrl) {
      throw badRequest("sourceUrl is required");
    }

    const response = await fetch(sourceUrl, {
      headers: {
        "user-agent": "NovaChatAI-KnowledgeBot/1.0"
      }
    });

    if (!response.ok) {
      throw badRequest(`Website source returned ${response.status}`);
    }

    const html = await response.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, " ");
  }
}

import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const knowledgeDocumentStatusSchema = z.enum(["UPLOADED", "PROCESSING", "COMPLETED", "FAILED"]);
export const knowledgeSourceTypeSchema = z.enum(["FILE", "URL"]);

export const createKnowledgeDocumentSchema = z.object({
  tenantId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  sourceType: knowledgeSourceTypeSchema.default("FILE"),
  sourceUrl: z.string().trim().url().max(2048).optional(),
  mimeType: z.string().trim().min(1).max(160).optional(),
  fileName: z.string().trim().max(240).optional(),
  contentBase64: z.string().trim().max(12_000_000).optional(),
  contentText: z.string().max(2_000_000).optional()
});

export const knowledgeDocumentIdParamSchema = z.object({
  id: z.string().uuid()
});

export const knowledgeDocumentListQuerySchema = paginationQuerySchema.extend({
  status: knowledgeDocumentStatusSchema.optional(),
  sourceType: knowledgeSourceTypeSchema.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title", "status"]).default("createdAt")
});

export const knowledgeTestSearchSchema = z.object({
  tenantId: z.string().uuid().optional(),
  query: z.string().trim().min(1).max(2000),
  topK: z.coerce.number().int().min(1).max(10).default(5)
});

export const knowledgeTestAnswerSchema = knowledgeTestSearchSchema.extend({
  customerName: z.string().trim().max(120).optional()
});

export type CreateKnowledgeDocumentInput = z.infer<typeof createKnowledgeDocumentSchema>;
export type KnowledgeDocumentListQuery = z.infer<typeof knowledgeDocumentListQuerySchema>;
export type KnowledgeTestSearchInput = z.infer<typeof knowledgeTestSearchSchema>;
export type KnowledgeTestAnswerInput = z.infer<typeof knowledgeTestAnswerSchema>;
export type KnowledgeDocumentStatus = z.infer<typeof knowledgeDocumentStatusSchema>;
export type KnowledgeSourceType = z.infer<typeof knowledgeSourceTypeSchema>;

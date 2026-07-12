import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";
import { aiProviderSchema } from "./ai.js";

export const aiAgentStatusSchema = z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);

const agentStringListSchema = z.array(z.string().trim().min(1).max(160)).max(60).default([]);

export const aiAgentListQuerySchema = paginationQuerySchema.extend({
  status: aiAgentStatusSchema.optional(),
  templateKey: z.string().trim().max(80).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "status"]).default("updatedAt")
});

export const aiAgentParamSchema = z.object({
  id: z.string().uuid()
});

export const aiAgentInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  templateKey: z.string().trim().max(80).nullable().optional(),
  provider: aiProviderSchema.default("OPENAI"),
  modelName: z.string().trim().min(2).max(80).default("gpt-4o-mini"),
  temperature: z.coerce.number().min(0).max(1).default(0.2),
  personality: z.string().trim().min(1).max(120).default("helpful"),
  tone: z.string().trim().min(1).max(80).default("professional"),
  supportedLanguages: agentStringListSchema.default(["English"]),
  systemPrompt: z.string().trim().min(10).max(8000),
  customPrompt: z.string().trim().max(8000).nullable().optional(),
  toolPermissions: agentStringListSchema,
  allowedActions: agentStringListSchema,
  handoverRules: agentStringListSchema,
  knowledgeDocumentIds: z.array(z.string().uuid()).max(100).default([]),
  assignedWhatsappAccountId: z.string().uuid().nullable().optional(),
  assignedChatbotId: z.string().uuid().nullable().optional()
});

export const aiAgentUpdateSchema = aiAgentInputSchema.partial().extend({
  status: aiAgentStatusSchema.optional()
});

export const aiAgentVersionInputSchema = z.object({
  changelog: z.string().trim().max(1000).optional()
});

export const aiAgentTestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().max(32).optional()
});

export type AiAgentListQuery = z.infer<typeof aiAgentListQuerySchema>;
export type AiAgentInput = z.infer<typeof aiAgentInputSchema>;
export type AiAgentUpdateInput = z.infer<typeof aiAgentUpdateSchema>;
export type AiAgentVersionInput = z.infer<typeof aiAgentVersionInputSchema>;
export type AiAgentTestInput = z.infer<typeof aiAgentTestSchema>;

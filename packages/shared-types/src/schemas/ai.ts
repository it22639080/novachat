import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const aiProviderSchema = z.enum(["OPENAI", "GEMINI"]);
export const aiToneSchema = z.enum(["friendly", "professional", "concise", "warm", "playful"]);

const createStringListSchema = (maxItemLength: number, maxItems = 40) =>
  z
    .array(z.string().trim().min(1).max(maxItemLength))
    .max(maxItems)
    .default([]);

const compactStringListSchema = createStringListSchema(120);
const servicesListSchema = createStringListSchema(500);
const policiesListSchema = createStringListSchema(1000);
const handoverKeywordListSchema = createStringListSchema(80);

export const aiSettingsSchema = z.object({
  isEnabled: z.boolean().default(false),
  provider: aiProviderSchema.default("OPENAI"),
  modelName: z.string().trim().min(2).max(80).default("gpt-4o-mini"),
  temperature: z.coerce.number().min(0).max(1).default(0.2),
  businessName: z.string().trim().max(120).nullable().optional(),
  businessDescription: z.string().trim().max(6000).nullable().optional(),
  tone: aiToneSchema.default("friendly"),
  supportedLanguages: compactStringListSchema.default(["English"]),
  openingHours: z.record(z.unknown()).nullable().optional(),
  services: servicesListSchema,
  policies: policiesListSchema,
  fallbackMessage: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .default("Thanks for your message. A team member will get back to you shortly."),
  handoverKeywords: handoverKeywordListSchema.default(["human", "agent", "support", "representative"])
});

export const updateAiSettingsSchema = aiSettingsSchema.partial();

export const aiTestReplySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().max(32).optional(),
  conversationId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional()
});

export const aiLogsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["SUCCESS", "FAILED", "BLOCKED"]).optional(),
  conversationId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "latencyMs", "status"]).default("createdAt")
});

export const conversationAiToggleSchema = z.object({
  aiEnabled: z.boolean().optional(),
  humanHandover: z.boolean().optional()
});

export const conversationIdParamSchema = z.object({
  id: z.string().uuid()
});

export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;
export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsSchema>;
export type AiTestReplyInput = z.infer<typeof aiTestReplySchema>;
export type AiLogsQuery = z.infer<typeof aiLogsQuerySchema>;
export type ConversationAiToggleInput = z.infer<typeof conversationAiToggleSchema>;

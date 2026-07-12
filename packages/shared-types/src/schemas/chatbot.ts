import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const chatbotStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);

export const chatbotNodeTypeSchema = z.enum([
  "start",
  "text",
  "buttons",
  "list",
  "question",
  "condition",
  "collect_info",
  "product_selection",
  "create_order",
  "appointment_booking",
  "api_webhook",
  "human_handover",
  "delay",
  "end"
]);

export const chatbotIdParamSchema = z.object({
  id: z.string().uuid()
});

export const chatbotFlowNodeSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: chatbotNodeTypeSchema,
  position: z.object({
    x: z.coerce.number(),
    y: z.coerce.number()
  }),
  data: z.record(z.unknown()).default({})
});

export const chatbotFlowEdgeSchema = z.object({
  id: z.string().trim().min(1).max(160),
  source: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(120),
  sourceHandle: z.string().trim().max(120).nullable().optional(),
  targetHandle: z.string().trim().max(120).nullable().optional(),
  label: z.string().trim().max(160).optional(),
  data: z.record(z.unknown()).default({})
});

export const chatbotFlowGraphSchema = z.object({
  nodes: z.array(chatbotFlowNodeSchema).min(1).max(200),
  edges: z.array(chatbotFlowEdgeSchema).max(400),
  viewport: z
    .object({
      x: z.coerce.number().default(0),
      y: z.coerce.number().default(0),
      zoom: z.coerce.number().min(0.1).max(3).default(1)
    })
    .optional()
});

export const chatbotInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  systemPrompt: z.string().trim().max(4000).default(""),
  status: chatbotStatusSchema.default("DRAFT"),
  modelProvider: z.enum(["OPENAI", "GEMINI"]).default("OPENAI"),
  modelName: z.string().trim().min(1).max(120).default("gpt-4o-mini"),
  temperature: z.coerce.number().min(0).max(1).default(0.2)
});

export const chatbotUpdateSchema = chatbotInputSchema.partial();

export const chatbotsQuerySchema = paginationQuerySchema.extend({
  status: chatbotStatusSchema.optional(),
  search: z.string().trim().max(160).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "status"]).default("updatedAt")
});

export const chatbotFlowSaveSchema = z.object({
  name: z.string().trim().min(1).max(160).default("Draft flow"),
  graph: chatbotFlowGraphSchema
});

export const chatbotTestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  customerName: z.string().trim().max(160).optional(),
  customerPhone: z.string().trim().max(40).optional()
});

export type ChatbotInput = z.infer<typeof chatbotInputSchema>;
export type ChatbotUpdateInput = z.infer<typeof chatbotUpdateSchema>;
export type ChatbotsQuery = z.infer<typeof chatbotsQuerySchema>;
export type ChatbotFlowGraph = z.infer<typeof chatbotFlowGraphSchema>;
export type ChatbotFlowSaveInput = z.infer<typeof chatbotFlowSaveSchema>;
export type ChatbotTestInput = z.infer<typeof chatbotTestSchema>;
export type ChatbotNodeType = z.infer<typeof chatbotNodeTypeSchema>;

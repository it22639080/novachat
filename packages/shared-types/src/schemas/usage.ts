import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const usageEventTypeSchema = z.enum([
  "AI_REPLY",
  "AI_INPUT_TOKEN",
  "AI_OUTPUT_TOKEN",
  "WHATSAPP_MESSAGE",
  "CREDIT_TOPUP",
  "LIMIT_RESET"
]);

export const creditTopUpTypeSchema = z.enum(["AI_REPLY", "WHATSAPP_MESSAGE"]);

export const billingStatusSchema = z.enum([
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELED"
]);

export const usageEventsQuerySchema = paginationQuerySchema.extend({
  type: usageEventTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "type", "quantity", "costEstimate"]).default("createdAt")
});

export const usageCostsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30)
});

export const addTenantCreditsSchema = z.object({
  type: creditTopUpTypeSchema,
  quantity: z.coerce.number().int().positive().max(1_000_000),
  reason: z.string().trim().max(500).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const updateTenantLimitsSchema = z.object({
  planName: z.string().trim().min(1).max(120).optional(),
  billingStatus: billingStatusSchema.optional(),
  aiMonthlyReplyLimit: z.coerce.number().int().min(0).max(100_000_000).optional(),
  whatsappMonthlyMessageLimit: z.coerce.number().int().min(0).max(100_000_000).optional(),
  dailyAiCostLimit: z.coerce.number().min(0).max(1_000_000).optional(),
  monthlyAiCostLimit: z.coerce.number().min(0).max(10_000_000).optional(),
  billingCycleStart: z.coerce.date().optional(),
  billingCycleEnd: z.coerce.date().nullable().optional()
});

export const updateTenantModelSchema = z.object({
  modelName: z.string().trim().min(2).max(80)
});

export const resetTenantUsageSchema = z.object({
  resetAi: z.boolean().default(true),
  resetWhatsapp: z.boolean().default(true),
  resetCosts: z.boolean().default(true),
  keepExtraCredits: z.boolean().default(true),
  reason: z.string().trim().max(500).optional()
});

export const tenantUsageParamSchema = z.object({
  tenantId: z.string().uuid()
});

export type UsageEventsQuery = z.infer<typeof usageEventsQuerySchema>;
export type UsageCostsQuery = z.infer<typeof usageCostsQuerySchema>;
export type AddTenantCreditsInput = z.infer<typeof addTenantCreditsSchema>;
export type UpdateTenantLimitsInput = z.infer<typeof updateTenantLimitsSchema>;
export type UpdateTenantModelInput = z.infer<typeof updateTenantModelSchema>;
export type ResetTenantUsageInput = z.infer<typeof resetTenantUsageSchema>;

import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const billingPlanCodeSchema = z.enum(["starter", "business", "professional", "enterprise"]);
export const subscriptionStatusSchema = z.enum([
  "TRIAL",
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELLED",
  "CANCELED",
  "EXPIRED"
]);
export const invoiceStatusSchema = z.enum(["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"]);
export const billingPaymentStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "SUCCEEDED",
  "FAILED",
  "OVERDUE",
  "REFUNDED",
  "CANCELLED",
  "CANCELED"
]);
export const billingCurrencySchema = z.enum(["USD", "LKR", "INR", "EUR", "GBP"]);

export const planLimitsSchema = z.object({
  whatsappAccounts: z.coerce.number().int().min(0).max(10_000),
  teamMembers: z.coerce.number().int().min(1).max(100_000),
  aiMonthlyReplies: z.coerce.number().int().min(0).max(100_000_000),
  monthlyConversations: z.coerce.number().int().min(0).max(100_000_000),
  monthlyCampaignSends: z.coerce.number().int().min(0).max(100_000_000),
  knowledgeBaseStorageMb: z.coerce.number().int().min(0).max(10_000_000),
  chatbots: z.coerce.number().int().min(0).max(100_000),
  advancedAnalytics: z.boolean(),
  integrations: z.boolean(),
  dailyAiCostLimit: z.coerce.number().min(0).max(1_000_000),
  monthlyAiCostLimit: z.coerce.number().min(0).max(10_000_000)
});

export const planInputSchema = z.object({
  code: billingPlanCodeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  priceMonthly: z.coerce.number().min(0).max(10_000_000),
  currency: billingCurrencySchema.default("USD"),
  limits: planLimitsSchema,
  isActive: z.boolean().default(true)
});

export const planUpdateSchema = planInputSchema.partial().extend({
  code: billingPlanCodeSchema.optional()
});

export const billingSubscribeSchema = z.object({
  planCode: billingPlanCodeSchema,
  trialDays: z.coerce.number().int().min(0).max(90).default(14),
  provider: z.enum(["manual", "stripe", "payhere"]).default("manual")
});

export const billingUpgradeSchema = z.object({
  planCode: billingPlanCodeSchema,
  provider: z.enum(["manual", "stripe", "payhere"]).default("manual")
});

export const billingCancelSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
  reason: z.string().trim().max(500).optional()
});

export const billingInvoicesQuerySchema = paginationQuerySchema.extend({
  status: invoiceStatusSchema.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "dueAt", "total", "status"]).default("createdAt")
});

export const billingPaymentsQuerySchema = paginationQuerySchema.extend({
  status: billingPaymentStatusSchema.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "amount", "status"]).default("createdAt")
});

export const billingPaymentProofInputSchema = z.object({
  invoiceId: z.string().uuid(),
  storageUrl: z.string().trim().url(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(120).optional(),
  fileSize: z.coerce.number().int().min(0).max(25 * 1024 * 1024).optional(),
  notes: z.string().trim().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const billingWebhookSchema = z.object({
  provider: z.enum(["stripe", "payhere"]).optional(),
  eventType: z.string().trim().max(160).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export type PlanLimits = z.infer<typeof planLimitsSchema>;
export type PlanInput = z.infer<typeof planInputSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
export type BillingSubscribeInput = z.infer<typeof billingSubscribeSchema>;
export type BillingUpgradeInput = z.infer<typeof billingUpgradeSchema>;
export type BillingCancelInput = z.infer<typeof billingCancelSchema>;
export type BillingInvoicesQuery = z.infer<typeof billingInvoicesQuerySchema>;
export type BillingPaymentsQuery = z.infer<typeof billingPaymentsQuerySchema>;
export type BillingPaymentProofInput = z.infer<typeof billingPaymentProofInputSchema>;
export type BillingWebhookInput = z.infer<typeof billingWebhookSchema>;

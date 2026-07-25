import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const adminTenantStatusSchema = z.enum([
  "PENDING_EMAIL_VERIFICATION",
  "PENDING_ADMIN_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "ARCHIVED"
]);

export const adminListQuerySchema = paginationQuerySchema.extend({
  status: z.string().trim().max(80).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "email", "status", "total"]).default("createdAt")
});

export const adminTenantParamSchema = z.object({
  tenantId: z.string().uuid()
});

export const adminUserParamSchema = z.object({
  id: z.string().uuid()
});

export const adminPlanParamSchema = z.object({
  id: z.string().uuid()
});

export const adminPaymentParamSchema = z.object({
  id: z.string().uuid()
});

export const adminTenantStatusUpdateSchema = z.object({
  status: adminTenantStatusSchema,
  reason: z.string().trim().max(500).optional()
});

export const adminRejectAccountSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

export const adminSuspendAccountSchema = z.object({
  reason: z.string().trim().max(1000).optional()
});

export const adminChangePlanSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  endAt: z.string().datetime().optional()
});

export const adminUsageCreditsSchema = z.object({
  aiReplyCredits: z.coerce.number().int().min(0).default(0),
  whatsappMessageCredits: z.coerce.number().int().min(0).default(0),
  reason: z.string().trim().max(500).optional()
});

export const adminPlanInputSchema = z.object({
  code: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  monthlyPrice: z.coerce.number().min(0),
  yearlyPrice: z.coerce.number().min(0).optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "INR"]).default("USD"),
  aiReplyLimit: z.coerce.number().int().min(0),
  aiInputTokenLimit: z.coerce.number().int().min(0).default(0),
  aiOutputTokenLimit: z.coerce.number().int().min(0).default(0),
  whatsappMessageLimit: z.coerce.number().int().min(0),
  agentLimit: z.coerce.number().int().min(1).default(1),
  whatsappAccountLimit: z.coerce.number().int().min(1).default(1),
  knowledgeBaseStorageLimitBytes: z.coerce.number().int().min(0).default(0),
  featuresJson: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true)
});

export const adminPlanUpdateSchema = adminPlanInputSchema.partial();

export const adminPaymentReviewSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(1000).optional()
});

export const adminAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(2000),
  audience: z.enum(["ALL", "OWNERS", "ADMINS"]).default("ALL")
});

export const adminFeatureFlagsSchema = z.object({
  aiAssistant: z.boolean().default(true),
  campaigns: z.boolean().default(true),
  billing: z.boolean().default(true),
  integrations: z.boolean().default(false),
  publicBooking: z.boolean().default(false)
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type AdminTenantStatusUpdateInput = z.infer<typeof adminTenantStatusUpdateSchema>;
export type AdminRejectAccountInput = z.infer<typeof adminRejectAccountSchema>;
export type AdminSuspendAccountInput = z.infer<typeof adminSuspendAccountSchema>;
export type AdminChangePlanInput = z.infer<typeof adminChangePlanSchema>;
export type AdminUsageCreditsInput = z.infer<typeof adminUsageCreditsSchema>;
export type AdminPlanInput = z.infer<typeof adminPlanInputSchema>;
export type AdminPlanUpdateInput = z.infer<typeof adminPlanUpdateSchema>;
export type AdminPaymentReviewInput = z.infer<typeof adminPaymentReviewSchema>;
export type AdminAnnouncementInput = z.infer<typeof adminAnnouncementSchema>;
export type AdminFeatureFlagsInput = z.infer<typeof adminFeatureFlagsSchema>;

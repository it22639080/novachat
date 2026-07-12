import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const campaignStatusSchema = z.enum(["DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"]);
export const campaignRecipientStatusSchema = z.enum(["PENDING", "SENT", "DELIVERED", "READ", "REPLIED", "FAILED", "OPTED_OUT"]);
export const templateStatusSchema = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "PAUSED"]);
export const templateCategorySchema = z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]);
export const automationTypeSchema = z.enum(["ONE_TIME", "BIRTHDAY", "FESTIVAL", "ABANDONED_CART", "FOLLOW_UP"]);

export const campaignIdParamSchema = z.object({
  id: z.string().uuid()
});

export const campaignAudienceSchema = z.object({
  source: z.enum(["ALL_CUSTOMERS", "SEGMENT", "CSV", "MANUAL"]).default("SEGMENT"),
  customerStatus: z.enum(["ACTIVE", "BLOCKED", "ARCHIVED"]).optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  optInOnly: z.boolean().default(true),
  excludeOptedOut: z.boolean().default(true),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
  csv: z.string().trim().max(2_000_000).optional(),
  manualRecipients: z
    .array(
      z.object({
        phone: z.string().trim().min(6).max(40),
        name: z.string().trim().max(160).optional(),
        customerId: z.string().uuid().optional()
      })
    )
    .max(5000)
    .default([]),
  automationType: automationTypeSchema.default("ONE_TIME")
});

export const campaignTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(512),
  languageCode: z.string().trim().min(2).max(20).default("en_US"),
  category: templateCategorySchema.default("MARKETING"),
  status: templateStatusSchema.default("APPROVED"),
  bodyText: z.string().trim().min(1).max(4000),
  components: z.array(z.record(z.unknown())).default([]),
  metadata: z.record(z.unknown()).default({})
});

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  whatsappAccountId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  templateName: z.string().trim().min(1).max(512).optional(),
  languageCode: z.string().trim().min(2).max(20).default("en_US"),
  status: campaignStatusSchema.default("DRAFT"),
  scheduledAt: z.coerce.date().optional(),
  audience: campaignAudienceSchema.default({})
});

export const campaignUpdateSchema = campaignInputSchema.partial().extend({
  status: campaignStatusSchema.optional()
});

export const campaignsQuerySchema = paginationQuerySchema.extend({
  status: campaignStatusSchema.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "status", "scheduledAt"]).default("createdAt")
});

export const campaignScheduleSchema = z.object({
  scheduledAt: z.coerce.date()
});

export const templatesQuerySchema = paginationQuerySchema.extend({
  status: templateStatusSchema.optional(),
  category: templateCategorySchema.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "status", "category"]).default("createdAt")
});

export type CampaignAudience = z.infer<typeof campaignAudienceSchema>;
export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
export type CampaignsQuery = z.infer<typeof campaignsQuerySchema>;
export type CampaignScheduleInput = z.infer<typeof campaignScheduleSchema>;
export type CampaignTemplateInput = z.infer<typeof campaignTemplateInputSchema>;
export type TemplatesQuery = z.infer<typeof templatesQuerySchema>;

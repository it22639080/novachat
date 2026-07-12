import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const adminTenantStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]);

export const adminListQuerySchema = paginationQuerySchema.extend({
  status: z.string().trim().max(80).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "email", "status", "total"]).default("createdAt")
});

export const adminTenantParamSchema = z.object({
  tenantId: z.string().uuid()
});

export const adminTenantStatusUpdateSchema = z.object({
  status: adminTenantStatusSchema,
  reason: z.string().trim().max(500).optional()
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
export type AdminAnnouncementInput = z.infer<typeof adminAnnouncementSchema>;
export type AdminFeatureFlagsInput = z.infer<typeof adminFeatureFlagsSchema>;

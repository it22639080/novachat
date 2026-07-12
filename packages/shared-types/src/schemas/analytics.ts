import { z } from "zod";

export const analyticsRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  timezone: z.string().trim().min(1).max(80).default("UTC")
});

export const analyticsExportQuerySchema = analyticsRangeSchema.extend({
  section: z.enum(["overview", "conversations", "leads", "orders", "agents", "ai"]).default("overview")
});

export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeSchema>;
export type AnalyticsExportQuery = z.infer<typeof analyticsExportQuerySchema>;

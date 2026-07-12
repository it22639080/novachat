import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const customerStatusSchema = z.enum(["ACTIVE", "BLOCKED", "ARCHIVED"]);
export const leadStatusSchema = z.enum(["OPEN", "WON", "LOST", "ARCHIVED"]);

export const crmIdParamSchema = z.object({
  id: z.string().uuid()
});

export const customersQuerySchema = paginationQuerySchema.extend({
  status: customerStatusSchema.optional(),
  tagId: z.string().uuid().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "email", "phone", "status"]).default("createdAt")
});

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().min(5).max(32),
  status: customerStatusSchema.default("ACTIVE"),
  customFields: z.record(z.unknown()).optional()
});

export const customerUpdateSchema = customerInputSchema.partial().extend({
  phone: z.string().trim().min(5).max(32).optional()
});

export const customerNoteSchema = z.object({
  body: z.string().trim().min(1).max(5000)
});

export const customerTagInputSchema = z.object({
  tagId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().trim().min(3).max(30).optional()
});

export const customerImportSchema = z.object({
  csv: z.string().min(1),
  updateExisting: z.boolean().default(true)
});

export const leadsQuerySchema = paginationQuerySchema.extend({
  status: leadStatusSchema.optional(),
  stageId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().or(z.enum(["me", "unassigned"])).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  followUpFrom: z.coerce.date().optional(),
  followUpTo: z.coerce.date().optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "value", "score", "expectedCloseDate", "followUpAt"])
    .default("createdAt")
});

export const leadInputSchema = z.object({
  customerId: z.string().uuid().optional(),
  customer: customerInputSchema.optional(),
  stageId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  status: leadStatusSchema.default("OPEN"),
  source: z.string().trim().min(1).max(80).optional(),
  value: z.coerce.number().min(0).max(999999999).optional(),
  currency: z.enum(["USD", "LKR", "INR", "EUR", "GBP"]).default("USD"),
  score: z.coerce.number().int().min(0).max(100).default(0),
  expectedCloseDate: z.coerce.date().optional(),
  followUpAt: z.coerce.date().optional(),
  followUpNote: z.string().trim().max(1000).optional(),
  aiScoreMetadata: z.record(z.unknown()).optional(),
  aiNextAction: z.string().trim().max(1000).optional()
});

export const leadUpdateSchema = leadInputSchema.partial();

export const leadStageMoveSchema = z.object({
  stageId: z.string().uuid()
});

export const leadStageInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().min(3).max(30).optional(),
  position: z.coerce.number().int().min(0).optional(),
  isDefault: z.boolean().default(false)
});

export const leadOutcomeSchema = z.object({
  status: z.enum(["WON", "LOST"])
});

export type CustomersQuery = z.infer<typeof customersQuerySchema>;
export type CustomerInput = z.infer<typeof customerInputSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type CustomerNoteInput = z.infer<typeof customerNoteSchema>;
export type CustomerTagInput = z.infer<typeof customerTagInputSchema>;
export type CustomerImportInput = z.infer<typeof customerImportSchema>;
export type LeadsQuery = z.infer<typeof leadsQuerySchema>;
export type LeadInput = z.infer<typeof leadInputSchema>;
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;
export type LeadStageMoveInput = z.infer<typeof leadStageMoveSchema>;
export type LeadStageInput = z.infer<typeof leadStageInputSchema>;
export type LeadOutcomeInput = z.infer<typeof leadOutcomeSchema>;

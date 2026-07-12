import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";

export const inboxConversationStatusSchema = z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]);
export const inboxMessageTypeSchema = z.enum(["text", "image", "document"]);

export const inboxConversationQuerySchema = paginationQuerySchema.extend({
  status: inboxConversationStatusSchema.optional(),
  assigneeId: z.string().uuid().or(z.enum(["me", "unassigned"])).optional(),
  unread: z.coerce.boolean().optional(),
  tagId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(["lastMessageAt", "createdAt", "customerName", "status"]).default("lastMessageAt")
});

export const inboxConversationIdParamSchema = z.object({
  id: z.string().uuid()
});

export const inboxConversationTagParamSchema = inboxConversationIdParamSchema.extend({
  tagId: z.string().uuid()
});

export const inboxSendMessageSchema = z.object({
  text: z.string().trim().min(1).max(4096),
  type: inboxMessageTypeSchema.default("text"),
  mediaUrl: z.string().trim().url().optional()
});

export const inboxAssignConversationSchema = z.object({
  assigneeUserId: z.string().uuid().nullable()
});

export const inboxChangeConversationStatusSchema = z.object({
  status: inboxConversationStatusSchema
});

export const inboxCreateNoteSchema = z.object({
  body: z.string().trim().min(1).max(5000)
});

export const inboxTagSchema = z.object({
  tagId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().trim().min(3).max(30).optional()
});

export type InboxConversationQuery = z.infer<typeof inboxConversationQuerySchema>;
export type InboxSendMessageInput = z.infer<typeof inboxSendMessageSchema>;
export type InboxAssignConversationInput = z.infer<typeof inboxAssignConversationSchema>;
export type InboxChangeConversationStatusInput = z.infer<
  typeof inboxChangeConversationStatusSchema
>;
export type InboxCreateNoteInput = z.infer<typeof inboxCreateNoteSchema>;
export type InboxTagInput = z.infer<typeof inboxTagSchema>;

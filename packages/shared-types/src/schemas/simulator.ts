import { z } from "zod";

export const simulatorMessageTypeSchema = z.enum([
  "text",
  "image",
  "document",
  "button_reply",
  "list_reply"
]);

export const simulatorDeliveryStatusSchema = z.enum(["queued", "sent", "delivered", "read", "failed"]);

export const createSimulatorCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(6).max(32)
});

export const incomingSimulatorMessageSchema = z.object({
  phone: z.string().trim().min(6).max(32),
  name: z.string().trim().min(2).max(120).optional(),
  type: simulatorMessageTypeSchema.default("text"),
  text: z.string().trim().max(4000).optional(),
  mediaUrl: z.string().trim().url().optional(),
  interactivePayload: z
    .object({
      id: z.string().trim().min(1).max(120),
      title: z.string().trim().min(1).max(240),
      description: z.string().trim().max(500).optional()
    })
    .optional()
});

export const outgoingSimulatorMessageSchema = z.object({
  conversationId: z.string().uuid(),
  type: simulatorMessageTypeSchema.default("text"),
  text: z.string().trim().max(4000).optional(),
  mediaUrl: z.string().trim().url().optional(),
  status: simulatorDeliveryStatusSchema.default("sent")
});

export type SimulatorMessageType = z.infer<typeof simulatorMessageTypeSchema>;
export type SimulatorDeliveryStatus = z.infer<typeof simulatorDeliveryStatusSchema>;
export type CreateSimulatorCustomerInput = z.infer<typeof createSimulatorCustomerSchema>;
export type IncomingSimulatorMessageInput = z.infer<typeof incomingSimulatorMessageSchema>;
export type OutgoingSimulatorMessageInput = z.infer<typeof outgoingSimulatorMessageSchema>;

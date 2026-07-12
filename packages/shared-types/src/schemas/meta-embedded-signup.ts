import { z } from "zod";

export const metaEmbeddedSignupCallbackSchema = z.object({
  code: z.string().trim().min(1).max(2048).optional(),
  accessToken: z.string().trim().min(20).max(4096).optional(),
  businessId: z.string().trim().min(1).max(120).optional(),
  wabaId: z.string().trim().min(1).max(120).optional(),
  phoneNumberId: z.string().trim().min(1).max(120).optional(),
  displayPhoneNumber: z.string().trim().min(6).max(32).optional(),
  verifiedName: z.string().trim().max(120).optional(),
  qualityRating: z.string().trim().max(80).optional(),
  expiresIn: z.coerce.number().int().positive().optional(),
  rawResult: z.record(z.unknown()).optional()
}).refine((value) => value.code || value.accessToken, {
  message: "Embedded signup callback requires an authorization code or access token.",
  path: ["code"]
});

export const metaEmbeddedSignupCompleteSchema = z.object({
  accountId: z.string().uuid()
});

export const metaEmbeddedSignupDisconnectSchema = z.object({
  accountId: z.string().uuid(),
  reason: z.string().trim().max(500).optional()
});

export const metaEmbeddedSignupHealthCheckSchema = z.object({
  accountId: z.string().uuid().optional()
});

export const metaAdminConnectionActionSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(["PENDING", "CONNECTED", "DISCONNECTED", "DISABLED"]).optional(),
  reason: z.string().trim().max(500).optional()
});

export type MetaEmbeddedSignupCallbackInput = z.infer<typeof metaEmbeddedSignupCallbackSchema>;
export type MetaEmbeddedSignupCompleteInput = z.infer<typeof metaEmbeddedSignupCompleteSchema>;
export type MetaEmbeddedSignupDisconnectInput = z.infer<typeof metaEmbeddedSignupDisconnectSchema>;
export type MetaEmbeddedSignupHealthCheckInput = z.infer<typeof metaEmbeddedSignupHealthCheckSchema>;
export type MetaAdminConnectionActionInput = z.infer<typeof metaAdminConnectionActionSchema>;

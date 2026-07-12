import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
});

export const apiMetaSchema = z.object({
  requestId: z.string().optional(),
  timestamp: z.string()
});

export const apiResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
    meta: apiMetaSchema
  });

export const apiFailureSchema = z.object({
  success: z.literal(false),
  error: apiErrorSchema,
  meta: apiMetaSchema
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiMeta = z.infer<typeof apiMetaSchema>;

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: ApiMeta;
};

export type ApiFailure = z.infer<typeof apiFailureSchema>;
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

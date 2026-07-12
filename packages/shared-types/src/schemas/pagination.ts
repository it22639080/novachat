import { z } from "zod";

export const sortDirectionSchema = z.enum(["asc", "desc"]);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  sortBy: z.string().trim().min(1).max(60).optional(),
  sortDirection: sortDirectionSchema.default("desc")
});

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0)
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export type PaginatedResult<T> = {
  items: T[];
  pagination: PaginationMeta;
};

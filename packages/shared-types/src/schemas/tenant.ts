import { z } from "zod";
import { platformRoleSchema } from "./auth.js";

export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  plan: z.string().min(1),
  role: platformRoleSchema,
  createdAt: z.string()
});

export const tenantIdParamSchema = z.object({
  tenantId: z.string().uuid()
});

export type TenantSummary = z.infer<typeof tenantSchema>;

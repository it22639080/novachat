import { z } from "zod";

export const platformRoleSchema = z.enum([
  "SUPER_ADMIN",
  "OWNER",
  "ADMIN",
  "MANAGER",
  "AGENT",
  "VIEWER"
]);

export const roleSchema = platformRoleSchema;

export const passwordPolicySchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(128)
  .refine((value) => /[a-z]/.test(value), "Password must include a lowercase letter.")
  .refine((value) => /[A-Z]/.test(value), "Password must include an uppercase letter.")
  .refine((value) => /\d/.test(value), "Password must include a number.")
  .refine((value) => /[^A-Za-z0-9]/.test(value), "Password must include a symbol.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  password: passwordPolicySchema,
  tenantName: z.string().trim().min(2).max(120),
  tenantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(128)
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: passwordPolicySchema
});

export const switchTenantSchema = z.object({
  tenantId: z.string().uuid()
});

export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  name: z.string().trim().min(2).max(120).optional(),
  role: roleSchema.exclude(["SUPER_ADMIN", "OWNER"])
});

export const updateTeamMemberRoleSchema = z.object({
  role: roleSchema.exclude(["SUPER_ADMIN", "OWNER"])
});

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).nullable(),
  isSuperAdmin: z.boolean()
});

export type PlatformRole = z.infer<typeof platformRoleSchema>;
export type Role = z.infer<typeof roleSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SwitchTenantInput = z.infer<typeof switchTenantSchema>;
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
export type UpdateTeamMemberRoleInput = z.infer<typeof updateTeamMemberRoleSchema>;

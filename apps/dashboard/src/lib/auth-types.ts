import type { Role } from "@novachat/shared-types";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
};

export type TenantAccess = {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  role: Role;
  permissions?: string[];
  createdAt?: string;
};

export type AuthState = {
  user: AuthUser | null;
  tenants: TenantAccess[];
  activeTenant: TenantAccess | null;
};

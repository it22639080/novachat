import type { PlatformRole, TenantSummary } from "@novachat/shared-types";

export type TenantMemberAccess = {
  tenantId: string;
  role: PlatformRole;
};

export interface MembershipRepository {
  findMembership(userId: string, tenantId: string): Promise<TenantMemberAccess | null>;
  listTenantsForUser(userId: string): Promise<TenantSummary[]>;
  listAllTenantsForPlatformAdmin(): Promise<TenantSummary[]>;
  tenantExists(tenantId: string): Promise<boolean>;
}

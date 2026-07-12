import type { AuthUser, PlatformRole, TenantSummary } from "@novachat/shared-types";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import { forbidden, notFound } from "../../shared/errors/app-error.js";

export class TenantAccessService {
  constructor(private readonly memberships: MembershipRepository) {}

  async listTenantsForUser(user: AuthUser): Promise<TenantSummary[]> {
    if (user.isSuperAdmin) {
      return this.memberships.listAllTenantsForPlatformAdmin();
    }

    return this.memberships.listTenantsForUser(user.id);
  }

  async assertTenantAccess(user: AuthUser, tenantId: string): Promise<PlatformRole> {
    if (user.isSuperAdmin) {
      const exists = await this.memberships.tenantExists(tenantId);

      if (!exists) {
        throw notFound("Tenant not found");
      }

      return "SUPER_ADMIN";
    }

    const membership = await this.memberships.findMembership(user.id, tenantId);

    if (!membership) {
      throw forbidden("Tenant access denied");
    }

    return membership.role;
  }
}

import { prisma } from "@novachat/database";
import type { PlatformRole, TenantSummary } from "@novachat/shared-types";
import type { MembershipRepository, TenantMemberAccess } from "../../domain/repositories/membership-repository.js";

const visibleTenantStatuses = [
  "ACTIVE",
  "APPROVED",
  "PENDING_EMAIL_VERIFICATION",
  "PENDING_ADMIN_APPROVAL",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED"
] as const;

export class PrismaMembershipRepository implements MembershipRepository {
  async findMembership(userId: string, tenantId: string): Promise<TenantMemberAccess | null> {
    const membership = await prisma.tenantMember.findFirst({
      where: {
        userId,
        tenantId,
        status: "ACTIVE",
        tenant: {
          status: { in: [...visibleTenantStatuses] }
        }
      },
      select: {
        tenantId: true,
        role: true
      }
    });

    if (!membership) {
      return null;
    }

    return {
      tenantId: membership.tenantId,
      role: membership.role as PlatformRole
    };
  }

  async listTenantsForUser(userId: string): Promise<TenantSummary[]> {
    const memberships = await prisma.tenantMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        tenant: {
          status: { in: [...visibleTenantStatuses] }
        }
      },
      select: {
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            subscriptions: {
              where: {
                deletedAt: null
              },
              select: {
                plan: {
                  select: {
                    code: true
                  }
                }
              },
              orderBy: {
                createdAt: "desc"
              },
              take: 1
            },
            createdAt: true
          }
        }
      },
      orderBy: {
        tenant: {
          name: "asc"
        }
      }
    });

    return memberships.map((membership) => ({
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      status: membership.tenant.status,
      plan: membership.tenant.subscriptions[0]?.plan.code ?? "free",
      role: membership.role as PlatformRole,
      createdAt: membership.tenant.createdAt.toISOString()
    }));
  }

  async listAllTenantsForPlatformAdmin(): Promise<TenantSummary[]> {
    const tenants = await prisma.tenant.findMany({
      where: {
        status: { in: [...visibleTenantStatuses] }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        subscriptions: {
          where: {
            deletedAt: null
          },
          select: {
            plan: {
              select: {
                code: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        },
        createdAt: true
      },
      orderBy: {
        name: "asc"
      }
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      plan: tenant.subscriptions[0]?.plan.code ?? "free",
      role: "SUPER_ADMIN",
      createdAt: tenant.createdAt.toISOString()
    }));
  }

  async tenantExists(tenantId: string): Promise<boolean> {
    const count = await prisma.tenant.count({
      where: {
        id: tenantId,
        status: { in: [...visibleTenantStatuses] }
      }
    });

    return count > 0;
  }
}

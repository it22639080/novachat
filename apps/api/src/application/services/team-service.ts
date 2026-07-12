import { prisma } from "@novachat/database";
import type { InviteTeamMemberInput, UpdateTeamMemberRoleInput } from "@novachat/shared-types";
import { forbidden, notFound } from "../../shared/errors/app-error.js";
import { BillingService } from "./billing-service.js";

type RequestMeta = {
  ipAddress: string | undefined;
  userAgent: string | undefined;
};

function auditMeta(meta: RequestMeta) {
  return {
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent ?? null
  };
}

const billingService = new BillingService();

export class TeamService {
  async inviteMember(tenantId: string, actorUserId: string, input: InviteTeamMemberInput, meta: RequestMeta) {
    const existingMember = await prisma.tenantMember.findFirst({
      where: {
        tenantId,
        user: { email: input.email },
        deletedAt: null
      },
      select: { id: true }
    });
    if (!existingMember) {
      await billingService.assertPlanAllowance(tenantId, "teamMembers");
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: input.email },
        update: input.name ? { name: input.name } : {},
        create: {
          email: input.email,
          name: input.name ?? input.email.split("@")[0] ?? input.email
        }
      });

      const member = await tx.tenantMember.upsert({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id
          }
        },
        update: {
          role: input.role,
          status: "INVITED",
          deletedAt: null
        },
        create: {
          tenantId,
          userId: user.id,
          role: input.role,
          status: "INVITED"
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: "team.invite",
          entityType: "TenantMember",
          entityId: member.id,
          metadata: { role: input.role, email: input.email },
          ...auditMeta(meta)
        }
      });

      return member;
    });

    return result;
  }

  async listMembers(tenantId: string) {
    return prisma.tenantMember.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async updateRole(
    tenantId: string,
    actorUserId: string,
    memberId: string,
    input: UpdateTeamMemberRoleInput,
    meta: RequestMeta
  ) {
    const member = await prisma.tenantMember.findFirst({
      where: { id: memberId, tenantId, deletedAt: null }
    });

    if (!member) {
      throw notFound("Team member not found");
    }

    if (member.role === "OWNER") {
      throw forbidden("Owner role cannot be changed from this endpoint");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.tenantMember.update({
        where: { id: member.id },
        data: { role: input.role },
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: "team.role.update",
          entityType: "TenantMember",
          entityId: member.id,
          metadata: { previousRole: member.role, nextRole: input.role },
          ...auditMeta(meta)
        }
      });

      return next;
    });

    return updated;
  }

  async removeMember(tenantId: string, actorUserId: string, memberId: string, meta: RequestMeta) {
    const member = await prisma.tenantMember.findFirst({
      where: { id: memberId, tenantId, deletedAt: null }
    });

    if (!member) {
      throw notFound("Team member not found");
    }

    if (member.role === "OWNER" || member.userId === actorUserId) {
      throw forbidden("This member cannot be removed from this endpoint");
    }

    await prisma.$transaction([
      prisma.tenantMember.update({
        where: { id: member.id },
        data: {
          status: "DISABLED",
          deletedAt: new Date()
        }
      }),
      prisma.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: "team.member.remove",
          entityType: "TenantMember",
          entityId: member.id,
          metadata: { removedUserId: member.userId, role: member.role },
          ...auditMeta(meta)
        }
      })
    ]);
  }
}

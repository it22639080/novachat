import type { NextFunction, Request, Response } from "express";
import { tenantIdParamSchema } from "@novachat/shared-types";
import { prisma } from "@novachat/database";
import { PrismaMembershipRepository } from "../../infrastructure/repositories/prisma-membership-repository.js";
import { TenantAccessService } from "../../application/services/tenant-access-service.js";
import { forbidden, unauthorized } from "../../shared/errors/app-error.js";

const tenantAccessService = new TenantAccessService(new PrismaMembershipRepository());
const approvedTenantStatuses = ["ACTIVE", "APPROVED"] as const;

export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  void (async () => {
    if (!req.user) {
      throw unauthorized();
    }

    const paramTenantId = req.params.tenantId;
    const headerTenantId = req.header("x-tenant-id");
    const tenantId = paramTenantId ?? headerTenantId ?? req.tenant?.id;
    const parsed = tenantIdParamSchema.parse({ tenantId });

    if (req.tenant?.id === parsed.tenantId) {
      next();
      return;
    }

    const role = await tenantAccessService.assertTenantAccess(req.user, parsed.tenantId);
    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.tenantId, deletedAt: null },
      select: { status: true, rejectionReason: true }
    });

    if (!tenant) {
      throw forbidden("Tenant access denied");
    }

    if (!req.user.isSuperAdmin && !approvedTenantStatuses.includes(tenant.status as (typeof approvedTenantStatuses)[number])) {
      throw forbidden(
        tenant.status === "REJECTED" && tenant.rejectionReason
          ? `Tenant account rejected: ${tenant.rejectionReason}`
          : `Tenant account is ${tenant.status}. Admin approval is required before dashboard APIs can be used.`
      );
    }

    req.tenant = {
      id: parsed.tenantId,
      role,
      permissions: []
    };

    next();
  })().catch(next);
}

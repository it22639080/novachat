import type { NextFunction, Request, Response } from "express";
import { tenantIdParamSchema } from "@novachat/shared-types";
import { PrismaMembershipRepository } from "../../infrastructure/repositories/prisma-membership-repository.js";
import { TenantAccessService } from "../../application/services/tenant-access-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";

const tenantAccessService = new TenantAccessService(new PrismaMembershipRepository());

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

    req.tenant = {
      id: parsed.tenantId,
      role,
      permissions: []
    };

    next();
  })().catch(next);
}

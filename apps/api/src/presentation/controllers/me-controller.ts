import type { Request, Response } from "express";
import { TenantAccessService } from "../../application/services/tenant-access-service.js";
import { PrismaMembershipRepository } from "../../infrastructure/repositories/prisma-membership-repository.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const tenantAccessService = new TenantAccessService(new PrismaMembershipRepository());

export class MeController {
  async tenants(req: Request, res: Response) {
    if (!req.user) {
      throw unauthorized();
    }

    const tenants = await tenantAccessService.listTenantsForUser(req.user);
    sendSuccess(res, tenants);
  }
}

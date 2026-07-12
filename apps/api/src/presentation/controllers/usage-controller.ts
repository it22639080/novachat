import type { Request, Response } from "express";
import { usageCostsQuerySchema, usageEventsQuerySchema } from "@novachat/shared-types";
import { UsageService } from "../../application/services/usage-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const usageService = new UsageService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class UsageController {
  async summary(req: Request, res: Response) {
    sendSuccess(res, await usageService.getSummary(tenantIdFromRequest(req)));
  }

  async events(req: Request, res: Response) {
    sendSuccess(
      res,
      await usageService.listEvents(tenantIdFromRequest(req), usageEventsQuerySchema.parse(req.query))
    );
  }

  async costs(req: Request, res: Response) {
    sendSuccess(
      res,
      await usageService.getCosts(tenantIdFromRequest(req), usageCostsQuerySchema.parse(req.query))
    );
  }
}

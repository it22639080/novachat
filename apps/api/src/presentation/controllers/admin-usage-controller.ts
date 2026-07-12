import type { Request, Response } from "express";
import {
  addTenantCreditsSchema,
  resetTenantUsageSchema,
  tenantUsageParamSchema,
  updateTenantLimitsSchema,
  updateTenantModelSchema
} from "@novachat/shared-types";
import { UsageService } from "../../application/services/usage-service.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const usageService = new UsageService();

export class AdminUsageController {
  async summary(req: Request, res: Response) {
    const { tenantId } = tenantUsageParamSchema.parse(req.params);
    sendSuccess(res, await usageService.getAdminTenantSummary(tenantId));
  }

  async addCredits(req: Request, res: Response) {
    const { tenantId } = tenantUsageParamSchema.parse(req.params);
    const result = await usageService.addCredits(
      tenantId,
      req.user?.id ?? null,
      addTenantCreditsSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async updateLimits(req: Request, res: Response) {
    const { tenantId } = tenantUsageParamSchema.parse(req.params);
    sendSuccess(res, await usageService.updateLimits(tenantId, updateTenantLimitsSchema.parse(req.body)));
  }

  async updateModel(req: Request, res: Response) {
    const { tenantId } = tenantUsageParamSchema.parse(req.params);
    sendSuccess(res, await usageService.updateModel(tenantId, updateTenantModelSchema.parse(req.body)));
  }

  async reset(req: Request, res: Response) {
    const { tenantId } = tenantUsageParamSchema.parse(req.params);
    sendSuccess(
      res,
      await usageService.resetUsage(tenantId, resetTenantUsageSchema.parse(req.body), req.user?.id ?? null)
    );
  }
}

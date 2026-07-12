import type { Request, Response } from "express";
import {
  adminAnnouncementSchema,
  adminFeatureFlagsSchema,
  adminListQuerySchema,
  adminTenantParamSchema,
  adminTenantStatusUpdateSchema
} from "@novachat/shared-types";
import { AdminPlatformService } from "../../application/services/admin-platform-service.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const adminPlatformService = new AdminPlatformService();

export class AdminPlatformController {
  async overview(_req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.overview());
  }

  async tenants(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.tenants(adminListQuerySchema.parse(req.query)));
  }

  async tenantDetail(req: Request, res: Response) {
    const { tenantId } = adminTenantParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.tenantDetail(tenantId));
  }

  async updateTenantStatus(req: Request, res: Response) {
    const { tenantId } = adminTenantParamSchema.parse(req.params);
    sendSuccess(
      res,
      await adminPlatformService.updateTenantStatus(
        tenantId,
        adminTenantStatusUpdateSchema.parse(req.body),
        req.user?.id ?? null
      )
    );
  }

  async users(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.users(adminListQuerySchema.parse(req.query)));
  }

  async plans(_req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.plans());
  }

  async subscriptions(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.subscriptions(adminListQuerySchema.parse(req.query)));
  }

  async billing(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.billing(adminListQuerySchema.parse(req.query)));
  }

  async usage(_req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.usage());
  }

  async auditLogs(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.auditLogs(adminListQuerySchema.parse(req.query)));
  }

  async systemHealth(_req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.systemHealth());
  }

  async settings(_req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.settings());
  }

  async updateFeatureFlags(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.updateFeatureFlags(adminFeatureFlagsSchema.parse(req.body)));
  }

  async createAnnouncement(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.createAnnouncement(adminAnnouncementSchema.parse(req.body)), 201);
  }
}

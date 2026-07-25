import type { Request, Response } from "express";
import {
  adminAnnouncementSchema,
  adminChangePlanSchema,
  adminFeatureFlagsSchema,
  adminListQuerySchema,
  adminPaymentParamSchema,
  adminPaymentReviewSchema,
  adminPlanInputSchema,
  adminPlanParamSchema,
  adminPlanUpdateSchema,
  adminRejectAccountSchema,
  adminSuspendAccountSchema,
  adminTenantParamSchema,
  adminTenantStatusUpdateSchema,
  adminUsageCreditsSchema,
  adminUserParamSchema
} from "@novachat/shared-types";
import { AdminPlatformService } from "../../application/services/admin-platform-service.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const adminPlatformService = new AdminPlatformService();

export class AdminPlatformController {
  async overview(_req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.overview());
  }

  async dashboard(req: Request, res: Response) {
    await this.overview(req, res);
  }

  async tenants(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.tenants(adminListQuerySchema.parse(req.query)));
  }

  async approvals(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.pendingApprovals(adminListQuerySchema.parse(req.query)));
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

  async userDetail(req: Request, res: Response) {
    const { id } = adminUserParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.userDetail(id));
  }

  async approveUser(req: Request, res: Response) {
    const { id } = adminUserParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.approveUser(id, req.user?.id ?? null));
  }

  async rejectUser(req: Request, res: Response) {
    const { id } = adminUserParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.rejectUser(id, adminRejectAccountSchema.parse(req.body), req.user?.id ?? null));
  }

  async suspendUser(req: Request, res: Response) {
    const { id } = adminUserParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.suspendUser(id, adminSuspendAccountSchema.parse(req.body), req.user?.id ?? null));
  }

  async reactivateUser(req: Request, res: Response) {
    const { id } = adminUserParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.reactivateUser(id, req.user?.id ?? null));
  }

  async changeUserPlan(req: Request, res: Response) {
    const { id } = adminUserParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.changeUserPlan(id, adminChangePlanSchema.parse(req.body), req.user?.id ?? null));
  }

  async addUserUsageCredits(req: Request, res: Response) {
    const { id } = adminUserParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.addUserUsageCredits(id, adminUsageCreditsSchema.parse(req.body), req.user?.id ?? null));
  }

  async plans(_req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.plans());
  }

  async createPlan(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.createPlan(adminPlanInputSchema.parse(req.body), req.user?.id ?? null), 201);
  }

  async updatePlan(req: Request, res: Response) {
    const { id } = adminPlanParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.updatePlan(id, adminPlanUpdateSchema.parse(req.body), req.user?.id ?? null));
  }

  async subscriptions(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.subscriptions(adminListQuerySchema.parse(req.query)));
  }

  async billing(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.billing(adminListQuerySchema.parse(req.query)));
  }

  async invoices(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.invoices(adminListQuerySchema.parse(req.query)));
  }

  async payments(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.payments(adminListQuerySchema.parse(req.query)));
  }

  async approvePayment(req: Request, res: Response) {
    const { id } = adminPaymentParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.approvePayment(id, adminPaymentReviewSchema.parse(req.body), req.user?.id ?? null));
  }

  async rejectPayment(req: Request, res: Response) {
    const { id } = adminPaymentParamSchema.parse(req.params);
    sendSuccess(res, await adminPlatformService.rejectPayment(id, adminPaymentReviewSchema.parse(req.body), req.user?.id ?? null));
  }

  async usage(_req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.usage());
  }

  async notifications(req: Request, res: Response) {
    sendSuccess(res, await adminPlatformService.notifications(adminListQuerySchema.parse(req.query)));
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

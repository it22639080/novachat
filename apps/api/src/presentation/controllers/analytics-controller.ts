import type { Request, Response } from "express";
import { analyticsRangeSchema } from "@novachat/shared-types";
import { AnalyticsService } from "../../application/services/analytics-service.js";
import { BillingService } from "../../application/services/billing-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const analyticsService = new AnalyticsService();
const billingService = new BillingService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class AnalyticsController {
  async overview(req: Request, res: Response) {
    sendSuccess(res, await analyticsService.overview(tenantIdFromRequest(req), analyticsRangeSchema.parse(req.query)));
  }

  async conversations(req: Request, res: Response) {
    await billingService.assertAdvancedAnalytics(tenantIdFromRequest(req));
    sendSuccess(res, await analyticsService.conversations(tenantIdFromRequest(req), analyticsRangeSchema.parse(req.query)));
  }

  async leads(req: Request, res: Response) {
    await billingService.assertAdvancedAnalytics(tenantIdFromRequest(req));
    sendSuccess(res, await analyticsService.leads(tenantIdFromRequest(req), analyticsRangeSchema.parse(req.query)));
  }

  async orders(req: Request, res: Response) {
    await billingService.assertAdvancedAnalytics(tenantIdFromRequest(req));
    sendSuccess(res, await analyticsService.orders(tenantIdFromRequest(req), analyticsRangeSchema.parse(req.query)));
  }

  async agents(req: Request, res: Response) {
    await billingService.assertAdvancedAnalytics(tenantIdFromRequest(req));
    sendSuccess(res, await analyticsService.agents(tenantIdFromRequest(req), analyticsRangeSchema.parse(req.query)));
  }

  async ai(req: Request, res: Response) {
    await billingService.assertAdvancedAnalytics(tenantIdFromRequest(req));
    sendSuccess(res, await analyticsService.ai(tenantIdFromRequest(req), analyticsRangeSchema.parse(req.query)));
  }

  async exportCsv(req: Request, res: Response) {
    await billingService.assertAdvancedAnalytics(tenantIdFromRequest(req));
    const csv = await analyticsService.exportCsv(tenantIdFromRequest(req), analyticsRangeSchema.parse(req.query));
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", 'attachment; filename="novachat-analytics.csv"');
    res.status(200).send(csv);
  }

  async exportPdf(req: Request, res: Response) {
    await billingService.assertAdvancedAnalytics(tenantIdFromRequest(req));
    const pdf = await analyticsService.exportPdf(tenantIdFromRequest(req), analyticsRangeSchema.parse(req.query));
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", 'attachment; filename="novachat-analytics.pdf"');
    res.status(200).send(pdf);
  }
}

import type { Request, Response } from "express";
import {
  billingCancelSchema,
  billingInvoicesQuerySchema,
  billingSubscribeSchema,
  billingUpgradeSchema,
  billingWebhookSchema,
  planInputSchema,
  planUpdateSchema
} from "@novachat/shared-types";
import { BillingService } from "../../application/services/billing-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const billingService = new BillingService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class BillingController {
  async plans(_req: Request, res: Response) {
    sendSuccess(res, await billingService.plans());
  }

  async createPlan(req: Request, res: Response) {
    sendSuccess(res, await billingService.createPlan(planInputSchema.parse(req.body)), 201);
  }

  async updatePlan(req: Request, res: Response) {
    sendSuccess(res, await billingService.updatePlan(String(req.params.code), planUpdateSchema.parse(req.body)));
  }

  async subscription(req: Request, res: Response) {
    sendSuccess(res, await billingService.subscription(tenantIdFromRequest(req)));
  }

  async subscribe(req: Request, res: Response) {
    sendSuccess(
      res,
      await billingService.subscribe(tenantIdFromRequest(req), billingSubscribeSchema.parse(req.body)),
      201
    );
  }

  async upgrade(req: Request, res: Response) {
    sendSuccess(res, await billingService.upgrade(tenantIdFromRequest(req), billingUpgradeSchema.parse(req.body)));
  }

  async cancel(req: Request, res: Response) {
    sendSuccess(res, await billingService.cancel(tenantIdFromRequest(req), billingCancelSchema.parse(req.body)));
  }

  async invoices(req: Request, res: Response) {
    sendSuccess(
      res,
      await billingService.invoices(tenantIdFromRequest(req), billingInvoicesQuerySchema.parse(req.query))
    );
  }

  async usage(req: Request, res: Response) {
    sendSuccess(res, await billingService.usage(tenantIdFromRequest(req)));
  }

  async stripeWebhook(req: Request, res: Response) {
    sendSuccess(res, await billingService.webhook("stripe", billingWebhookSchema.parse(req.body)));
  }

  async payHereWebhook(req: Request, res: Response) {
    sendSuccess(res, await billingService.webhook("payhere", billingWebhookSchema.parse(req.body)));
  }
}

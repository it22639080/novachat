import type { Request, Response } from "express";
import {
  billingCancelSchema,
  billingInvoicesQuerySchema,
  billingPaymentProofInputSchema,
  billingPaymentsQuerySchema,
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

  async payments(req: Request, res: Response) {
    sendSuccess(
      res,
      await billingService.payments(tenantIdFromRequest(req), billingPaymentsQuerySchema.parse(req.query))
    );
  }

  async paymentProof(req: Request, res: Response) {
    if (!req.user?.id) {
      throw unauthorized("Authenticated user context is required");
    }

    sendSuccess(
      res,
      await billingService.createPaymentProof(
        tenantIdFromRequest(req),
        req.user.id,
        billingPaymentProofInputSchema.parse(req.body)
      ),
      201
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

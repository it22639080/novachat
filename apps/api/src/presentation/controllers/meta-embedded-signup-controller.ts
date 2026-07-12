import type { Request, Response } from "express";
import {
  metaAdminConnectionActionSchema,
  metaEmbeddedSignupCallbackSchema,
  metaEmbeddedSignupCompleteSchema,
  metaEmbeddedSignupDisconnectSchema,
  metaEmbeddedSignupHealthCheckSchema
} from "@novachat/shared-types";
import { MetaEmbeddedSignupService } from "../../application/services/meta-embedded-signup-service.js";
import { badRequest, unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const metaEmbeddedSignupService = new MetaEmbeddedSignupService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

function adminTenantIdFromRequest(req: Request) {
  const tenantId = req.params.tenantId;
  if (typeof tenantId !== "string" || !tenantId) {
    throw badRequest("Tenant ID is required");
  }
  return tenantId;
}

function adminAccountIdFromRequest(req: Request) {
  const accountId = req.params.accountId;
  if (typeof accountId !== "string" || !accountId) {
    throw badRequest("WhatsApp account ID is required");
  }
  return accountId;
}

export class MetaEmbeddedSignupController {
  async config(_req: Request, res: Response) {
    sendSuccess(res, metaEmbeddedSignupService.config());
  }

  async callback(req: Request, res: Response) {
    sendSuccess(
      res,
      await metaEmbeddedSignupService.callback(
        tenantIdFromRequest(req),
        metaEmbeddedSignupCallbackSchema.parse(req.body),
        req.user?.id ?? null
      ),
      201
    );
  }

  async complete(req: Request, res: Response) {
    sendSuccess(
      res,
      await metaEmbeddedSignupService.complete(
        tenantIdFromRequest(req),
        metaEmbeddedSignupCompleteSchema.parse(req.body),
        req.user?.id ?? null
      )
    );
  }

  async disconnect(req: Request, res: Response) {
    sendSuccess(
      res,
      await metaEmbeddedSignupService.disconnect(
        tenantIdFromRequest(req),
        metaEmbeddedSignupDisconnectSchema.parse(req.body),
        req.user?.id ?? null
      )
    );
  }

  async status(req: Request, res: Response) {
    sendSuccess(res, await metaEmbeddedSignupService.status(tenantIdFromRequest(req)));
  }

  async healthCheck(req: Request, res: Response) {
    sendSuccess(
      res,
      await metaEmbeddedSignupService.healthCheck(
        tenantIdFromRequest(req),
        metaEmbeddedSignupHealthCheckSchema.parse(req.body)
      )
    );
  }

  async adminHealthCheck(req: Request, res: Response) {
    const input = metaAdminConnectionActionSchema.parse({
      accountId: adminAccountIdFromRequest(req)
    });
    sendSuccess(
      res,
      await metaEmbeddedSignupService.healthCheck(adminTenantIdFromRequest(req), { accountId: input.accountId })
    );
  }

  async adminDisconnect(req: Request, res: Response) {
    const input = metaAdminConnectionActionSchema.parse({
      accountId: adminAccountIdFromRequest(req),
      reason: req.body?.reason
    });
    sendSuccess(
      res,
      await metaEmbeddedSignupService.disconnect(
        adminTenantIdFromRequest(req),
        { accountId: input.accountId, reason: input.reason },
        req.user?.id ?? null
      )
    );
  }

  async adminOverrideStatus(req: Request, res: Response) {
    const input = metaAdminConnectionActionSchema.parse({
      accountId: adminAccountIdFromRequest(req),
      status: req.body?.status
    });

    if (!input.status) {
      throw badRequest("Status is required");
    }

    sendSuccess(
      res,
      await metaEmbeddedSignupService.adminStatusOverride(
        adminTenantIdFromRequest(req),
        input.accountId,
        input.status,
        req.user?.id ?? null
      )
    );
  }
}

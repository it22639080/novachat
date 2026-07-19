import type { Request, Response } from "express";
import {
  whatsAppWebConnectSchema,
  whatsAppWebDisconnectSchema
} from "@novachat/shared-types";
import { WhatsAppWebService } from "../../application/services/whatsapp-web-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const whatsAppWebService = new WhatsAppWebService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

function userIdFromRequest(req: Request) {
  if (!req.user?.id) {
    throw unauthorized();
  }

  return req.user.id;
}

export class WhatsAppWebController {
  async status(req: Request, res: Response) {
    const result = await whatsAppWebService.status(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async connect(req: Request, res: Response) {
    const result = await whatsAppWebService.connect(
      tenantIdFromRequest(req),
      userIdFromRequest(req),
      whatsAppWebConnectSchema.parse(req.body)
    );
    sendSuccess(res, result, 202);
  }

  async reconnect(req: Request, res: Response) {
    const result = await whatsAppWebService.reconnect(tenantIdFromRequest(req), userIdFromRequest(req));
    sendSuccess(res, result, 202);
  }

  async disconnect(req: Request, res: Response) {
    const result = await whatsAppWebService.disconnect(
      tenantIdFromRequest(req),
      whatsAppWebDisconnectSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async logout(req: Request, res: Response) {
    const result = await whatsAppWebService.logout(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }
}

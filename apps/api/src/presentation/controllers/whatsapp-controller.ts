import type { Request, Response } from "express";
import {
  createWhatsAppAccountSchema,
  sendWhatsAppButtonsSchema,
  sendWhatsAppListSchema,
  sendWhatsAppMediaSchema,
  sendWhatsAppTemplateSchema,
  sendWhatsAppTextSchema,
  updateWhatsAppAccountSchema,
  whatsAppAccountIdParamSchema
} from "@novachat/shared-types";
import { WhatsAppService } from "../../application/services/whatsapp-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const whatsAppService = new WhatsAppService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class WhatsAppController {
  async verifyWebhook(req: Request, res: Response) {
    const challenge = await whatsAppService.verifyWebhook(req.query);
    res.status(200).send(challenge);
  }

  async handleWebhook(req: Request, res: Response) {
    const result = await whatsAppService.handleWebhook(req.body);
    sendSuccess(res, result);
  }

  async createAccount(req: Request, res: Response) {
    const result = await whatsAppService.createAccount(
      tenantIdFromRequest(req),
      createWhatsAppAccountSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async accounts(req: Request, res: Response) {
    const result = await whatsAppService.listAccounts(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async webhookLogs(req: Request, res: Response) {
    const result = await whatsAppService.listWebhookLogs(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async updateAccount(req: Request, res: Response) {
    const { id } = whatsAppAccountIdParamSchema.parse(req.params);
    const result = await whatsAppService.updateAccount(
      tenantIdFromRequest(req),
      id,
      updateWhatsAppAccountSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async deleteAccount(req: Request, res: Response) {
    const { id } = whatsAppAccountIdParamSchema.parse(req.params);
    const result = await whatsAppService.deleteAccount(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async sendText(req: Request, res: Response) {
    const result = await whatsAppService.sendText(
      tenantIdFromRequest(req),
      sendWhatsAppTextSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async sendMedia(req: Request, res: Response) {
    const result = await whatsAppService.sendMedia(
      tenantIdFromRequest(req),
      sendWhatsAppMediaSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async sendTemplate(req: Request, res: Response) {
    const result = await whatsAppService.sendTemplate(
      tenantIdFromRequest(req),
      sendWhatsAppTemplateSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async sendButtons(req: Request, res: Response) {
    const result = await whatsAppService.sendButtons(
      tenantIdFromRequest(req),
      sendWhatsAppButtonsSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async sendList(req: Request, res: Response) {
    const result = await whatsAppService.sendList(
      tenantIdFromRequest(req),
      sendWhatsAppListSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }
}

import type { Request, Response } from "express";
import {
  campaignIdParamSchema,
  campaignInputSchema,
  campaignScheduleSchema,
  campaignsQuerySchema,
  campaignTemplateInputSchema,
  campaignUpdateSchema,
  templatesQuerySchema
} from "@novachat/shared-types";
import { CampaignService } from "../../application/services/campaign-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const campaignService = new CampaignService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class CampaignController {
  async campaigns(req: Request, res: Response) {
    const result = await campaignService.campaigns(
      tenantIdFromRequest(req),
      campaignsQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async createCampaign(req: Request, res: Response) {
    const result = await campaignService.createCampaign(
      tenantIdFromRequest(req),
      campaignInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async campaign(req: Request, res: Response) {
    const { id } = campaignIdParamSchema.parse(req.params);
    const result = await campaignService.campaign(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async updateCampaign(req: Request, res: Response) {
    const { id } = campaignIdParamSchema.parse(req.params);
    const result = await campaignService.updateCampaign(
      tenantIdFromRequest(req),
      id,
      campaignUpdateSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async deleteCampaign(req: Request, res: Response) {
    const { id } = campaignIdParamSchema.parse(req.params);
    const result = await campaignService.deleteCampaign(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async schedule(req: Request, res: Response) {
    const { id } = campaignIdParamSchema.parse(req.params);
    const result = await campaignService.schedule(
      tenantIdFromRequest(req),
      id,
      campaignScheduleSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async sendNow(req: Request, res: Response) {
    const { id } = campaignIdParamSchema.parse(req.params);
    const result = await campaignService.sendNow(tenantIdFromRequest(req), id);
    sendSuccess(res, result, 202);
  }

  async stop(req: Request, res: Response) {
    const { id } = campaignIdParamSchema.parse(req.params);
    const result = await campaignService.stop(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async analytics(req: Request, res: Response) {
    const { id } = campaignIdParamSchema.parse(req.params);
    const result = await campaignService.analytics(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async templates(req: Request, res: Response) {
    const result = await campaignService.templates(
      tenantIdFromRequest(req),
      templatesQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async createTemplate(req: Request, res: Response) {
    const result = await campaignService.createTemplate(
      tenantIdFromRequest(req),
      campaignTemplateInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }
}

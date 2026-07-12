import type { Request, Response } from "express";
import {
  aiLogsQuerySchema,
  aiTestReplySchema,
  conversationAiToggleSchema,
  conversationIdParamSchema,
  updateAiSettingsSchema
} from "@novachat/shared-types";
import { AiAssistantEngineService } from "../../application/services/ai-assistant-engine-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const aiService = new AiAssistantEngineService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class AiController {
  async settings(req: Request, res: Response) {
    const result = await aiService.getSettings(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }

  async updateSettings(req: Request, res: Response) {
    const result = await aiService.updateSettings(
      tenantIdFromRequest(req),
      updateAiSettingsSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async testReply(req: Request, res: Response) {
    const result = await aiService.testReply(
      tenantIdFromRequest(req),
      aiTestReplySchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async logs(req: Request, res: Response) {
    const result = await aiService.listLogs(
      tenantIdFromRequest(req),
      aiLogsQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async toggleConversation(req: Request, res: Response) {
    const { id } = conversationIdParamSchema.parse(req.params);
    const result = await aiService.toggleConversation(
      tenantIdFromRequest(req),
      id,
      conversationAiToggleSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }
}

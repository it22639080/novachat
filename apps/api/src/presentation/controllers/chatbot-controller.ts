import type { Request, Response } from "express";
import {
  chatbotFlowSaveSchema,
  chatbotIdParamSchema,
  chatbotInputSchema,
  chatbotTestSchema,
  chatbotsQuerySchema,
  chatbotUpdateSchema
} from "@novachat/shared-types";
import { ChatbotService } from "../../application/services/chatbot-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const chatbotService = new ChatbotService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class ChatbotController {
  async chatbots(req: Request, res: Response) {
    const result = await chatbotService.chatbots(
      tenantIdFromRequest(req),
      chatbotsQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async createChatbot(req: Request, res: Response) {
    const result = await chatbotService.createChatbot(
      tenantIdFromRequest(req),
      chatbotInputSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async chatbot(req: Request, res: Response) {
    const { id } = chatbotIdParamSchema.parse(req.params);
    const result = await chatbotService.chatbot(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async updateChatbot(req: Request, res: Response) {
    const { id } = chatbotIdParamSchema.parse(req.params);
    const result = await chatbotService.updateChatbot(
      tenantIdFromRequest(req),
      id,
      chatbotUpdateSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async deleteChatbot(req: Request, res: Response) {
    const { id } = chatbotIdParamSchema.parse(req.params);
    const result = await chatbotService.deleteChatbot(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async saveFlow(req: Request, res: Response) {
    const { id } = chatbotIdParamSchema.parse(req.params);
    const result = await chatbotService.saveFlow(
      tenantIdFromRequest(req),
      id,
      chatbotFlowSaveSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async publish(req: Request, res: Response) {
    const { id } = chatbotIdParamSchema.parse(req.params);
    const result = await chatbotService.publish(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async test(req: Request, res: Response) {
    const { id } = chatbotIdParamSchema.parse(req.params);
    const result = await chatbotService.test(
      tenantIdFromRequest(req),
      id,
      chatbotTestSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }
}

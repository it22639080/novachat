import type { Request, Response } from "express";
import {
  inboxAssignConversationSchema,
  inboxChangeConversationStatusSchema,
  inboxConversationIdParamSchema,
  inboxConversationTagParamSchema,
  inboxConversationQuerySchema,
  inboxCreateNoteSchema,
  inboxSendMessageSchema,
  inboxTagSchema
} from "@novachat/shared-types";
import { InboxService } from "../../application/services/inbox-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const inboxService = new InboxService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

function actorFromRequest(req: Request) {
  if (!req.user || !req.tenant?.role) {
    throw unauthorized("Authenticated tenant user is required");
  }

  return {
    userId: req.user.id,
    role: req.tenant.role
  };
}

export class InboxController {
  async conversations(req: Request, res: Response) {
    const result = await inboxService.listConversations(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      inboxConversationQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async search(req: Request, res: Response) {
    const result = await inboxService.searchConversations(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      inboxConversationQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async thread(req: Request, res: Response) {
    const { id } = inboxConversationIdParamSchema.parse(req.params);
    const result = await inboxService.getThread(tenantIdFromRequest(req), actorFromRequest(req), id);
    sendSuccess(res, result);
  }

  async sendMessage(req: Request, res: Response) {
    const { id } = inboxConversationIdParamSchema.parse(req.params);
    const result = await inboxService.sendMessage(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      id,
      inboxSendMessageSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async assign(req: Request, res: Response) {
    const { id } = inboxConversationIdParamSchema.parse(req.params);
    const result = await inboxService.assignConversation(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      id,
      inboxAssignConversationSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async changeStatus(req: Request, res: Response) {
    const { id } = inboxConversationIdParamSchema.parse(req.params);
    const result = await inboxService.changeStatus(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      id,
      inboxChangeConversationStatusSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async markRead(req: Request, res: Response) {
    const { id } = inboxConversationIdParamSchema.parse(req.params);
    const result = await inboxService.markRead(tenantIdFromRequest(req), actorFromRequest(req), id);
    sendSuccess(res, result);
  }

  async createNote(req: Request, res: Response) {
    const { id } = inboxConversationIdParamSchema.parse(req.params);
    const result = await inboxService.createNote(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      id,
      inboxCreateNoteSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async addTag(req: Request, res: Response) {
    const { id } = inboxConversationIdParamSchema.parse(req.params);
    const result = await inboxService.addTag(
      tenantIdFromRequest(req),
      actorFromRequest(req),
      id,
      inboxTagSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async removeTag(req: Request, res: Response) {
    const { id, tagId } = inboxConversationTagParamSchema.parse(req.params);
    const result = await inboxService.removeTag(tenantIdFromRequest(req), actorFromRequest(req), id, tagId);
    sendSuccess(res, result);
  }

  async assignees(req: Request, res: Response) {
    const result = await inboxService.listAssignees(tenantIdFromRequest(req));
    sendSuccess(res, result);
  }
}

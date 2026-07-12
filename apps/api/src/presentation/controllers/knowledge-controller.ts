import type { Request, Response } from "express";
import {
  createKnowledgeDocumentSchema,
  knowledgeDocumentIdParamSchema,
  knowledgeDocumentListQuerySchema,
  knowledgeTestAnswerSchema,
  knowledgeTestSearchSchema
} from "@novachat/shared-types";
import { KnowledgeService } from "../../application/services/knowledge-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const knowledgeService = new KnowledgeService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }

  return req.tenant.id;
}

export class KnowledgeController {
  async create(req: Request, res: Response) {
    const result = await knowledgeService.createDocument(
      tenantIdFromRequest(req),
      createKnowledgeDocumentSchema.parse(req.body)
    );
    sendSuccess(res, result, 201);
  }

  async list(req: Request, res: Response) {
    const result = await knowledgeService.listDocuments(
      tenantIdFromRequest(req),
      knowledgeDocumentListQuerySchema.parse(req.query)
    );
    sendSuccess(res, result);
  }

  async detail(req: Request, res: Response) {
    const { id } = knowledgeDocumentIdParamSchema.parse(req.params);
    const result = await knowledgeService.getDocument(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async delete(req: Request, res: Response) {
    const { id } = knowledgeDocumentIdParamSchema.parse(req.params);
    const result = await knowledgeService.deleteDocument(tenantIdFromRequest(req), id);
    sendSuccess(res, result);
  }

  async reprocess(req: Request, res: Response) {
    const { id } = knowledgeDocumentIdParamSchema.parse(req.params);
    const result = await knowledgeService.reprocessDocument(tenantIdFromRequest(req), id);
    sendSuccess(res, result, 202);
  }

  async testSearch(req: Request, res: Response) {
    const result = await knowledgeService.testSearch(
      tenantIdFromRequest(req),
      knowledgeTestSearchSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }

  async testAnswer(req: Request, res: Response) {
    const result = await knowledgeService.testAnswer(
      tenantIdFromRequest(req),
      knowledgeTestAnswerSchema.parse(req.body)
    );
    sendSuccess(res, result);
  }
}

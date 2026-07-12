import type { Request, Response } from "express";
import {
  aiAgentInputSchema,
  aiAgentListQuerySchema,
  aiAgentParamSchema,
  aiAgentTestSchema,
  aiAgentUpdateSchema,
  aiAgentVersionInputSchema
} from "@novachat/shared-types";
import { AiAgentService } from "../../application/services/ai-agent-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const aiAgentService = new AiAgentService();

function tenantIdFromRequest(req: Request) {
  if (!req.tenant?.id) {
    throw unauthorized("Tenant context is required");
  }
  return req.tenant.id;
}

export class AiAgentController {
  async templates(_req: Request, res: Response) {
    sendSuccess(res, aiAgentService.templates());
  }

  async list(req: Request, res: Response) {
    sendSuccess(res, await aiAgentService.list(tenantIdFromRequest(req), aiAgentListQuerySchema.parse(req.query)));
  }

  async create(req: Request, res: Response) {
    sendSuccess(
      res,
      await aiAgentService.create(tenantIdFromRequest(req), aiAgentInputSchema.parse(req.body), req.user?.id ?? null),
      201
    );
  }

  async get(req: Request, res: Response) {
    const { id } = aiAgentParamSchema.parse(req.params);
    sendSuccess(res, await aiAgentService.get(tenantIdFromRequest(req), id));
  }

  async update(req: Request, res: Response) {
    const { id } = aiAgentParamSchema.parse(req.params);
    sendSuccess(
      res,
      await aiAgentService.update(tenantIdFromRequest(req), id, aiAgentUpdateSchema.parse(req.body), req.user?.id ?? null)
    );
  }

  async delete(req: Request, res: Response) {
    const { id } = aiAgentParamSchema.parse(req.params);
    sendSuccess(res, await aiAgentService.delete(tenantIdFromRequest(req), id, req.user?.id ?? null));
  }

  async versions(req: Request, res: Response) {
    const { id } = aiAgentParamSchema.parse(req.params);
    sendSuccess(res, await aiAgentService.versions(tenantIdFromRequest(req), id));
  }

  async createVersion(req: Request, res: Response) {
    const { id } = aiAgentParamSchema.parse(req.params);
    sendSuccess(
      res,
      await aiAgentService.createVersion(
        tenantIdFromRequest(req),
        id,
        aiAgentVersionInputSchema.parse(req.body),
        req.user?.id ?? null
      ),
      201
    );
  }

  async activate(req: Request, res: Response) {
    const { id } = aiAgentParamSchema.parse(req.params);
    sendSuccess(res, await aiAgentService.setStatus(tenantIdFromRequest(req), id, "ACTIVE", req.user?.id ?? null));
  }

  async deactivate(req: Request, res: Response) {
    const { id } = aiAgentParamSchema.parse(req.params);
    sendSuccess(res, await aiAgentService.setStatus(tenantIdFromRequest(req), id, "INACTIVE", req.user?.id ?? null));
  }

  async test(req: Request, res: Response) {
    const { id } = aiAgentParamSchema.parse(req.params);
    sendSuccess(res, await aiAgentService.test(tenantIdFromRequest(req), id, aiAgentTestSchema.parse(req.body)), 201);
  }
}

import type { Request, Response } from "express";
import { paginationQuerySchema } from "@novachat/shared-types";
import { AuditLogService } from "../../application/services/audit-log-service.js";
import { PrismaAuditLogRepository } from "../../infrastructure/repositories/prisma-audit-log-repository.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const auditLogService = new AuditLogService(new PrismaAuditLogRepository());

export class AuditLogController {
  async index(req: Request, res: Response) {
    const query = paginationQuerySchema.parse(req.query);
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      throw new Error("Tenant context missing after tenant middleware");
    }

    const auditLogs = await auditLogService.listTenantAuditLogs(tenantId, query);
    sendSuccess(res, auditLogs);
  }
}

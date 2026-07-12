import type { PaginationQuery } from "@novachat/shared-types";
import type { AuditLogRepository } from "../../domain/repositories/audit-log-repository.js";

export class AuditLogService {
  constructor(private readonly auditLogs: AuditLogRepository) {}

  listTenantAuditLogs(tenantId: string, query: PaginationQuery) {
    return this.auditLogs.listByTenant(tenantId, query);
  }
}

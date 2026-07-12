import type { PaginatedResult, PaginationQuery } from "@novachat/shared-types";

export type AuditLogListItem = {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export interface AuditLogRepository {
  listByTenant(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<AuditLogListItem>>;
}

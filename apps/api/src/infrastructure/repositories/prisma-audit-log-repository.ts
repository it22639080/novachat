import type { Prisma } from "@novachat/database";
import { prisma } from "@novachat/database";
import type { PaginationQuery } from "@novachat/shared-types";
import type { AuditLogListItem, AuditLogRepository } from "../../domain/repositories/audit-log-repository.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";

const allowedSortFields = new Set(["createdAt", "action", "entityType"]);

export class PrismaAuditLogRepository implements AuditLogRepository {
  async listByTenant(tenantId: string, query: PaginationQuery) {
    const pagination = createPagination(query);
    const where: Prisma.AuditLogWhereInput = {
      tenantId
    };

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: "insensitive" } },
        { entityType: { contains: query.search, mode: "insensitive" } }
      ];
    }

    const sortBy = query.sortBy && allowedSortFields.has(query.sortBy) ? query.sortBy : "createdAt";

    const [total, items] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: {
          [sortBy]: query.sortDirection
        },
        select: {
          id: true,
          tenantId: true,
          actorUserId: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          createdAt: true
        }
      })
    ]);

    return {
      items: items.map<AuditLogListItem>((item) => ({
        ...item,
        tenantId: item.tenantId ?? tenantId,
        createdAt: item.createdAt.toISOString()
      })),
      pagination: pagination.meta(total)
    };
  }
}

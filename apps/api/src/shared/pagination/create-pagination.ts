import type { PaginationQuery } from "@novachat/shared-types";

export function createPagination(query: PaginationQuery) {
  const skip = (query.page - 1) * query.pageSize;

  return {
    skip,
    take: query.pageSize,
    meta(total: number) {
      return {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize)
      };
    }
  };
}

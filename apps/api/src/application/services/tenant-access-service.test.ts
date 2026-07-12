import { describe, expect, it } from "vitest";
import type { AuthUser } from "@novachat/shared-types";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import { TenantAccessService } from "./tenant-access-service.js";

const user: AuthUser = {
  id: "0d7b24a5-f148-4f6f-9a8f-e6f04f88db32",
  email: "owner@novachat.ai",
  name: "Owner",
  isSuperAdmin: false
};

describe("TenantAccessService", () => {
  it("rejects users without tenant membership", async () => {
    const repository: MembershipRepository = {
      findMembership: async () => null,
      listTenantsForUser: async () => [],
      listAllTenantsForPlatformAdmin: async () => [],
      tenantExists: async () => false
    };

    const service = new TenantAccessService(repository);

    await expect(service.assertTenantAccess(user, "6e842e83-fc1a-4584-81e2-e0aa41ee4972")).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN"
    });
  });
});

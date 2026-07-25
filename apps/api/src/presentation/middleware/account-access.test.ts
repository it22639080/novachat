import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  tenantUsageCounterFindUnique: vi.fn()
}));

vi.mock("@novachat/database", () => ({
  prisma: {
    tenant: {
      findFirst: prismaMocks.tenantFindFirst
    },
    subscription: {
      findFirst: prismaMocks.subscriptionFindFirst
    },
    tenantUsageCounter: {
      findUnique: prismaMocks.tenantUsageCounterFindUnique
    }
  }
}));

import { requireActiveSubscription, requireAdmin, requireApprovedTenant, requireAvailableUsage } from "./account-access.js";

function createRequest(overrides: Partial<Request> = {}) {
  return {
    user: {
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      isSuperAdmin: false
    },
    tenant: {
      id: "tenant_1",
      role: "OWNER",
      permissions: []
    },
    header: vi.fn(),
    params: {},
    ...overrides
  } as unknown as Request;
}

function runMiddleware(middleware: (req: Request, res: Response, next: NextFunction) => void, req: Request) {
  return new Promise<unknown>((resolve) => {
    middleware(req, {} as Response, (error?: unknown) => resolve(error ?? "next"));
  });
}

describe("account access middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks non-admin tenant members from admin actions", async () => {
    const result = await runMiddleware(
      requireAdmin,
      createRequest({
        tenant: { id: "tenant_1", role: "AGENT", permissions: [] }
      })
    );

    expect(result).toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  it("allows tenant owners to perform admin actions", async () => {
    await expect(runMiddleware(requireAdmin, createRequest())).resolves.toBe("next");
  });

  it("blocks tenant APIs until admin approval is completed", async () => {
    prismaMocks.tenantFindFirst.mockResolvedValue({
      status: "PENDING_ADMIN_APPROVAL",
      rejectionReason: null
    });

    const result = await runMiddleware(requireApprovedTenant, createRequest());

    expect(result).toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  it("allows approved tenants through tenant feature gates", async () => {
    prismaMocks.tenantFindFirst.mockResolvedValue({
      status: "APPROVED",
      rejectionReason: null
    });

    await expect(runMiddleware(requireApprovedTenant, createRequest())).resolves.toBe("next");
  });

  it("blocks expired subscriptions", async () => {
    prismaMocks.subscriptionFindFirst.mockResolvedValue({
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() - 60_000),
      endAt: null
    });

    const result = await runMiddleware(requireActiveSubscription, createRequest());

    expect(result).toMatchObject({ statusCode: 402, code: "SUBSCRIPTION_INACTIVE" });
  });

  it("blocks requests when usage limits are reached", async () => {
    prismaMocks.tenantUsageCounterFindUnique.mockResolvedValue({
      aiDisabledDueToLimit: true,
      whatsappDisabledDueToLimit: false
    });

    const result = await runMiddleware(requireAvailableUsage, createRequest());

    expect(result).toMatchObject({ statusCode: 402, code: "LIMIT_REACHED" });
  });
});

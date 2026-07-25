import { prisma } from "@novachat/database";
import type { NextFunction, Request, Response } from "express";
import { forbidden, paymentRequired, unauthorized } from "../../shared/errors/app-error.js";

const approvedTenantStatuses = ["ACTIVE", "APPROVED"] as const;
const activeSubscriptionStatuses = ["TRIAL", "TRIALING", "ACTIVE"] as const;

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(unauthorized());
    return;
  }

  if (req.user.isSuperAdmin || req.tenant?.role === "OWNER" || req.tenant?.role === "ADMIN") {
    next();
    return;
  }

  next(forbidden("Admin access is required for this tenant"));
}

export function requireApprovedTenant(req: Request, _res: Response, next: NextFunction) {
  void (async () => {
    if (!req.user) {
      throw unauthorized();
    }

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    const rawTenantId = req.tenant?.id ?? req.header("x-tenant-id") ?? req.params.tenantId;
    const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
    if (!tenantId) {
      throw forbidden("Tenant is required");
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { status: true, rejectionReason: true }
    });

    if (!tenant) {
      throw forbidden("Tenant access denied");
    }

    if (!approvedTenantStatuses.includes(tenant.status as (typeof approvedTenantStatuses)[number])) {
      throw forbidden(
        tenant.status === "REJECTED" && tenant.rejectionReason
          ? `Tenant account rejected: ${tenant.rejectionReason}`
          : `Tenant account is ${tenant.status}. Admin approval is required before dashboard APIs can be used.`
      );
    }

    next();
  })().catch(next);
}

export function requireActiveSubscription(req: Request, _res: Response, next: NextFunction) {
  void (async () => {
    if (!req.user) {
      throw unauthorized();
    }

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw forbidden("Tenant is required");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        deletedAt: null
      },
      select: {
        status: true,
        currentPeriodEnd: true,
        endAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    const periodEnd = subscription?.endAt ?? subscription?.currentPeriodEnd;
    const isExpired = periodEnd ? periodEnd.getTime() < Date.now() : false;

    if (
      !subscription ||
      isExpired ||
      !activeSubscriptionStatuses.includes(subscription.status as (typeof activeSubscriptionStatuses)[number])
    ) {
      throw paymentRequired(
        "SUBSCRIPTION_INACTIVE",
        "Your subscription is inactive or expired. Please renew your plan to continue."
      );
    }

    next();
  })().catch(next);
}

export function requireAvailableUsage(req: Request, _res: Response, next: NextFunction) {
  void (async () => {
    if (!req.user) {
      throw unauthorized();
    }

    const tenantId = req.tenant?.id;
    if (!tenantId || req.user.isSuperAdmin) {
      next();
      return;
    }

    const state = await prisma.tenantUsageCounter.findUnique({
      where: { tenantId },
      select: {
        aiDisabledDueToLimit: true,
        whatsappDisabledDueToLimit: true
      }
    });

    if (state?.aiDisabledDueToLimit || state?.whatsappDisabledDueToLimit) {
      throw paymentRequired(
        "LIMIT_REACHED",
        "A usage limit has been reached. Upgrade the plan or contact an admin for extra credits."
      );
    }

    next();
  })().catch(next);
}

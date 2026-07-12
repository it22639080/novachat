import type { NextFunction, Request, Response } from "express";
import type { PlatformRole } from "@novachat/shared-types";
import { forbidden, unauthorized } from "../../shared/errors/app-error.js";

const roleWeight: Record<PlatformRole, number> = {
  SUPER_ADMIN: 100,
  OWNER: 90,
  ADMIN: 80,
  MANAGER: 60,
  AGENT: 40,
  VIEWER: 10
};

function getRoleWeight(role: PlatformRole) {
  return roleWeight[role] ?? 0;
}

export function requireRole(allowedRoles: PlatformRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !req.tenant) {
      next(unauthorized());
      return;
    }

    if (req.user.isSuperAdmin || allowedRoles.includes(req.tenant.role)) {
      next();
      return;
    }

    const minimumWeight = Math.min(...allowedRoles.map(getRoleWeight));
    const currentWeight = getRoleWeight(req.tenant.role);

    if (currentWeight >= minimumWeight) {
      next();
      return;
    }

    next(forbidden());
  };
}

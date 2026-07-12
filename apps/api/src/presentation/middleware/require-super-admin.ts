import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../../shared/errors/app-error.js";

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(unauthorized());
    return;
  }

  if (!req.user.isSuperAdmin) {
    next(forbidden("Super admin access is required"));
    return;
  }

  next();
}

import type { NextFunction, Request, Response } from "express";
import { PermissionService } from "../../application/services/permission-service.js";
import { forbidden, unauthorized } from "../../shared/errors/app-error.js";

const permissionService = new PermissionService();

export function requirePermission(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.tenant) {
        throw unauthorized();
      }

      if (req.user.isSuperAdmin) {
        next();
        return;
      }

      const permissions =
        req.tenant.permissions && req.tenant.permissions.length > 0
          ? req.tenant.permissions
          : await permissionService.permissionsForRole(req.tenant.role);

      req.tenant.permissions = permissions;

      if (!permissionService.hasPermission(permissions, permission)) {
        throw forbidden("Missing required permission");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

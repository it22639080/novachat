import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { TokenService } from "../../infrastructure/auth/token-service.js";
import { authCookieNames } from "../../shared/http/cookies.js";
import { unauthorized } from "../../shared/errors/app-error.js";

const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).nullable().optional(),
  isSuperAdmin: z.boolean().default(false),
  tenantId: z.string().uuid().optional(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "ADMIN", "MANAGER", "AGENT", "VIEWER"]).optional(),
  permissions: z.array(z.string()).optional()
});

const tokenService = new TokenService();

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const cookieToken = req.cookies?.[authCookieNames.accessToken] as string | undefined;
  const token = bearerToken ?? cookieToken;

  if (!token) {
    next(unauthorized());
    return;
  }

  try {
    const decoded = tokenService.verifyAccessToken(token);
    const payload = jwtPayloadSchema.parse(decoded);

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      isSuperAdmin: payload.isSuperAdmin
    };

    if (payload.tenantId && payload.role) {
      req.tenant = {
        id: payload.tenantId,
        role: payload.role,
        permissions: payload.permissions ?? []
      };
    }

    next();
  } catch {
    next(unauthorized("Invalid or expired authentication token"));
  }
}

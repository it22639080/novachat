import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthUser, PlatformRole } from "@novachat/shared-types";
import { env } from "../../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  tenantId?: string;
  role?: PlatformRole;
  permissions?: string[];
};

export class TokenService {
  createAccessToken(params: {
    user: AuthUser;
    tenant?: { id: string; role: PlatformRole; permissions?: string[] };
  }) {
    const payload: AccessTokenPayload = {
      sub: params.user.id,
      email: params.user.email,
      name: params.user.name,
      isSuperAdmin: params.user.isSuperAdmin
    };

    if (params.tenant) {
      payload.tenantId = params.tenant.id;
      payload.role = params.tenant.role;
      payload.permissions = params.tenant.permissions ?? [];
    }

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN_SECONDS
    });
  }

  verifyAccessToken(token: string) {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  }

  createRefreshToken() {
    return randomBytes(48).toString("base64url");
  }

  createOpaqueToken() {
    return randomBytes(32).toString("base64url");
  }

  hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}

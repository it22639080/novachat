import type { AuthUser, PlatformRole } from "@novachat/shared-types";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
      tenant?: {
        id: string;
        role: PlatformRole;
        permissions?: string[];
      };
    }
  }
}

export {};

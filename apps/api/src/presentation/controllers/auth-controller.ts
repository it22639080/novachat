import type { Request, Response } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  switchTenantSchema
} from "@novachat/shared-types";
import { AuthService } from "../../application/services/auth-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { clearAuthCookies, setAuthCookies, authCookieNames } from "../../shared/http/cookies.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const authService = new AuthService();

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.header("user-agent")
  };
}

export class AuthController {
  async register(req: Request, res: Response) {
    const result = await authService.register(registerSchema.parse(req.body), requestMeta(req));
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    sendSuccess(res, {
      user: result.user,
      activeTenant: result.activeTenant,
      emailVerificationRequired: result.emailVerificationRequired
    }, 201);
  }

  async login(req: Request, res: Response) {
    const result = await authService.login(loginSchema.parse(req.body), requestMeta(req));
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    sendSuccess(res, {
      user: result.user,
      tenants: result.tenants
    });
  }

  async logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.[authCookieNames.refreshToken] as string | undefined;
    await authService.logout(refreshToken);
    clearAuthCookies(res);
    sendSuccess(res, { loggedOut: true });
  }

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.[authCookieNames.refreshToken] as string | undefined;
    const result = await authService.refresh(refreshToken, requestMeta(req));
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
    sendSuccess(res, { user: result.user });
  }

  async forgotPassword(req: Request, res: Response) {
    const result = await authService.forgotPassword(forgotPasswordSchema.parse(req.body));
    sendSuccess(res, {
      message: "If an account exists, password reset instructions will be sent.",
      resetToken: result.resetToken
    });
  }

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(resetPasswordSchema.parse(req.body));
    clearAuthCookies(res);
    sendSuccess(res, { passwordReset: true });
  }

  async me(req: Request, res: Response) {
    if (!req.user) {
      throw unauthorized();
    }

    const result = await authService.me(req.user.id);
    const activeTenant = req.tenant
      ? (result.tenants.find((tenant) => tenant.id === req.tenant?.id) ?? null)
      : null;

    sendSuccess(res, {
      ...result,
      activeTenant: activeTenant
        ? {
            ...activeTenant,
            role: req.tenant?.role ?? activeTenant.role,
            permissions: req.tenant?.permissions ?? activeTenant.permissions
          }
        : null
    });
  }

  async switchTenant(req: Request, res: Response) {
    if (!req.user) {
      throw unauthorized();
    }

    const result = await authService.switchTenant(
      req.user.id,
      switchTenantSchema.parse(req.body),
      requestMeta(req)
    );
    setAuthCookies(res, { accessToken: result.accessToken });
    sendSuccess(res, {
      user: result.user,
      activeTenant: result.activeTenant
    });
  }
}

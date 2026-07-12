import type { Response } from "express";
import { env } from "../../config/env.js";

export const authCookieNames = {
  accessToken: "novachat_access_token",
  refreshToken: "novachat_refresh_token"
} as const;

const baseCookieOptions = {
  httpOnly: true,
  sameSite: env.COOKIE_SECURE ? ("none" as const) : ("lax" as const),
  secure: env.COOKIE_SECURE,
  path: "/"
};

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken?: string }
) {
  res.cookie(authCookieNames.accessToken, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: env.JWT_ACCESS_EXPIRES_IN_SECONDS * 1000
  });

  if (tokens.refreshToken) {
    res.cookie(authCookieNames.refreshToken, tokens.refreshToken, {
      ...baseCookieOptions,
      maxAge: env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
    });
  }
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(authCookieNames.accessToken, baseCookieOptions);
  res.clearCookie(authCookieNames.refreshToken, baseCookieOptions);
}

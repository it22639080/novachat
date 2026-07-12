import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../../config/env.js";
import { authCookieNames } from "../../shared/http/cookies.js";
import { AppError, badRequest } from "../../shared/errors/app-error.js";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const blockedKeys = new Set(["__proto__", "prototype", "constructor"]);

function splitOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const allowedCorsOrigins = splitOrigins(env.CORS_ORIGIN);

export function isAllowedCorsOrigin(origin: string | undefined) {
  if (!origin) return true;
  return allowedCorsOrigins.includes("*") || allowedCorsOrigins.includes(origin);
}

export function corsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  if (isAllowedCorsOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new AppError({ statusCode: 403, code: "CORS_ORIGIN_DENIED", message: "CORS origin is not allowed" }));
}

function clientKey(req: Request) {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}): RequestHandler {
  const buckets = new Map<string, RateLimitEntry>();

  return (req, res, next) => {
    if (env.NODE_ENV === "test") {
      next();
      return;
    }

    const now = Date.now();
    const key = `${options.keyPrefix}:${clientKey(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    current.count += 1;
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfterSeconds.toString());
    res.setHeader("X-RateLimit-Limit", options.maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, options.maxRequests - current.count).toString());
    res.setHeader("X-RateLimit-Reset", new Date(current.resetAt).toISOString());

    if (current.count > options.maxRequests) {
      next(
        new AppError({
          statusCode: 429,
          code: "RATE_LIMITED",
          message: "Too many requests. Please slow down and try again shortly."
        })
      );
      return;
    }

    next();
  };
}

function hasBlockedKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some(hasBlockedKey);
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (blockedKeys.has(key) || hasBlockedKey(nested)) {
      return true;
    }
  }

  return false;
}

export function requestIntegrityGuard(req: Request, _res: Response, next: NextFunction) {
  if (hasBlockedKey(req.body) || hasBlockedKey(req.query) || hasBlockedKey(req.params)) {
    next(badRequest("Request contains unsafe object keys."));
    return;
  }

  next();
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (!env.CSRF_PROTECTION_ENABLED || !unsafeMethods.has(req.method)) {
    next();
    return;
  }

  if (req.path.startsWith("/webhooks/")) {
    next();
    return;
  }

  const authorization = req.header("authorization");
  const usesBearer = Boolean(authorization?.startsWith("Bearer "));
  const hasAuthCookie = Boolean(
    req.cookies?.[authCookieNames.accessToken] || req.cookies?.[authCookieNames.refreshToken]
  );

  if (!hasAuthCookie || usesBearer) {
    next();
    return;
  }

  if (req.header("x-novachat-csrf") === "same-origin") {
    next();
    return;
  }

  next(
    new AppError({
      statusCode: 403,
      code: "CSRF_TOKEN_REQUIRED",
      message: "CSRF protection header is required for cookie-authenticated write requests."
    })
  );
}

import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createRequire } from "node:module";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestHandler, Request } from "express";
import type { Options as PinoHttpOptions } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./infrastructure/logger/logger.js";
import { errorHandler } from "./presentation/middleware/error-handler.js";
import { requestContextMiddleware } from "./presentation/middleware/request-context.js";
import {
  corsOrigin,
  createRateLimiter,
  csrfProtection,
  requestIntegrityGuard
} from "./presentation/middleware/security.js";
import { apiRouter } from "./presentation/routes/index.js";

const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http") as (options: PinoHttpOptions) => RequestHandler;

type LoggableRequest = IncomingMessage & {
  id?: string | number;
  raw?: IncomingMessage;
  remoteAddress?: string;
  remotePort?: number;
};

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'none'"],
          "base-uri": ["'none'"],
          "frame-ancestors": ["'none'"],
          "form-action": ["'none'"]
        }
      },
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: env.REQUEST_JSON_LIMIT, strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));
  app.use(requestIntegrityGuard);
  app.use(csrfProtection);
  app.use(requestContextMiddleware);
  app.use(
    createRateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      keyPrefix: "api"
    })
  );
  app.use(
    ["/api/auth/login", "/api/v1/auth/login", "/api/auth/register", "/api/v1/auth/register"],
    createRateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
      keyPrefix: "auth"
    })
  );
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req: LoggableRequest) => {
          const raw = req.raw ?? req;

          return {
            id: req.id,
            method: req.method ?? raw.method,
            url: req.url ?? raw.url,
            remoteAddress: req.remoteAddress ?? raw.socket?.remoteAddress,
            remotePort: req.remotePort ?? raw.socket?.remotePort
          };
        },
        res: (res: ServerResponse) => ({
          statusCode: res.statusCode
        })
      },
      customProps: (req) => ({ requestId: (req as Request).requestId })
    })
  );

  app.use("/api", apiRouter);
  app.use("/api/v1", apiRouter);
  app.use(errorHandler);

  return app;
}

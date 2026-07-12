import pino from "pino";
import { env } from "../../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.set-cookie",
      "req.headers.x-api-key",
      "res.headers.set-cookie",
      "password",
      "token",
      "secret",
      "apiKey",
      "accessToken",
      "refreshToken",
      "*.password",
      "*.token",
      "*.secret",
      "*.apiKey",
      "*.accessToken",
      "*.refreshToken"
    ],
    censor: "[REDACTED]"
  }
});

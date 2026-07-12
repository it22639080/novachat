import { z } from "zod";
import { loadApiEnv } from "./load-env.js";

loadApiEnv();

const optionalNonEmptyString = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());
const booleanEnv = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off", ""].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).default(30),
  PASSWORD_RESET_EXPIRES_IN_MINUTES: z.coerce.number().int().min(5).default(30),
  COOKIE_SECURE: booleanEnv.default(false),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  REQUEST_JSON_LIMIT: z.string().min(2).default("15mb"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(20),
  CSRF_PROTECTION_ENABLED: booleanEnv.default(true),
  TRUST_PROXY: booleanEnv.default(false),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  WHATSAPP_GRAPH_API_VERSION: z.string().min(2).default("v20.0"),
  WHATSAPP_TOKEN_ENCRYPTION_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32).optional()
  ),
  META_APP_ID: optionalNonEmptyString,
  META_APP_SECRET: optionalNonEmptyString,
  META_CONFIG_ID: optionalNonEmptyString,
  META_API_VERSION: z.string().min(2).default("v20.0"),
  META_REDIRECT_URI: optionalNonEmptyString,
  META_WEBHOOK_VERIFY_TOKEN: optionalNonEmptyString,
  META_SYSTEM_USER_ACCESS_TOKEN: optionalNonEmptyString,
  META_ALLOW_EXISTING_WHATSAPP_FALLBACK: booleanEnv.default(false),
  META_COEXISTENCE_ONBOARDING_ENABLED: booleanEnv.default(false),
  META_EMBEDDED_SIGNUP_FEATURE_TYPE: optionalNonEmptyString,
  META_EMBEDDED_SIGNUP_ENABLED: booleanEnv.default(false),
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_EMBEDDING_MODEL: z.string().min(2).default("text-embedding-3-small"),
  GEMINI_API_KEY: optionalNonEmptyString
});

export const env = envSchema.parse(process.env);

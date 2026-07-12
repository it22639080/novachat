import { PrismaClient } from "@prisma/client";
import pino from "pino";

export { Prisma, PrismaClient } from "@prisma/client";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["password", "token", "secret", "apiKey"],
    censor: "[REDACTED]"
  }
});

export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" }
  ]
});

prisma.$on("error", (event) => {
  logger.error(event, "Prisma error");
});

prisma.$on("warn", (event) => {
  logger.warn(event, "Prisma warning");
});

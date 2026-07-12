import { setTimeout as delay } from "node:timers/promises";
import { Redis } from "ioredis";
import { prisma } from "@novachat/database";
import { env } from "../../config/env.js";
import { logger } from "../logger/logger.js";

const startupTimeoutMs = 45_000;
const retryDelayMs = 1_500;

function elapsedSince(startedAt: number) {
  return Date.now() - startedAt;
}

function redisVersionIsSupported(version: string) {
  const [major = "0"] = version.split(".");
  return Number(major) >= 5;
}

async function retryUntilReady(name: string, check: () => Promise<void>) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (elapsedSince(startedAt) < startupTimeoutMs) {
    try {
      await check();
      logger.info({ dependency: name }, "Startup dependency ready");
      return;
    } catch (error) {
      lastError = error;
      logger.warn({ dependency: name, err: error }, "Waiting for startup dependency");
      await delay(retryDelayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${name} did not become ready within ${startupTimeoutMs}ms`);
}

export async function waitForDatabase() {
  await retryUntilReady("postgres", async () => {
    await prisma.$queryRaw`SELECT 1`;
  });
}

export async function waitForRedis() {
  await retryUntilReady("redis", async () => {
    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });

    try {
      await redis.connect();
      const info = await redis.info("server");
      const version = info.match(/redis_version:([^\r\n]+)/)?.[1]?.trim() ?? "0.0.0";

      if (!redisVersionIsSupported(version)) {
        throw new Error(`Redis ${version} is not supported. BullMQ requires Redis 5 or newer.`);
      }
    } finally {
      redis.disconnect();
    }
  });
}

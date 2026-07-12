import { prisma } from "@novachat/database";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./infrastructure/logger/logger.js";
import { createRealtimeServer } from "./infrastructure/realtime/realtime.js";
import { waitForDatabase, waitForRedis } from "./infrastructure/startup/startup-checks.js";

async function bootstrap() {
  await waitForDatabase();
  await waitForRedis();

  const app = createApp();
  const httpServer = createRealtimeServer(app);
  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals) {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "NovaChat API shutting down");

    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await prisma.$disconnect();
    logger.info("NovaChat API shutdown complete");
  }

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM").then(() => process.exit(0)).catch((error) => {
      logger.error({ err: error }, "NovaChat API shutdown failed");
      process.exit(1);
    });
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT").then(() => process.exit(0)).catch((error) => {
      logger.error({ err: error }, "NovaChat API shutdown failed");
      process.exit(1);
    });
  });

  httpServer.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT, host: "0.0.0.0", environment: env.NODE_ENV }, "NovaChat API started");
    logger.info(
      {
        openAiBaseUrl: env.OPENAI_BASE_URL,
        hasOpenAiKey: Boolean(env.OPENAI_API_KEY)
      },
      "OpenAI configuration loaded"
    );

    if (!env.OPENAI_API_KEY) {
      logger.warn("OPENAI_API_KEY is missing. AI generation will fail until it is added to the backend .env and the API is restarted.");
    }

    logger.info(
      {
        embeddedSignupEnabled: env.META_EMBEDDED_SIGNUP_ENABLED,
        hasMetaAppId: Boolean(env.META_APP_ID),
        hasMetaConfigId: Boolean(env.META_CONFIG_ID),
        hasMetaAppSecret: Boolean(env.META_APP_SECRET),
        hasMetaWebhookVerifyToken: Boolean(env.META_WEBHOOK_VERIFY_TOKEN)
      },
      "Meta Embedded Signup configuration loaded"
    );
  });
}

void bootstrap().catch((error) => {
  logger.fatal({ err: error }, "NovaChat API failed to start");
  process.exit(1);
});

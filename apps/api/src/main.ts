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

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, environment: env.NODE_ENV }, "NovaChat API started");
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

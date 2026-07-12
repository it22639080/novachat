import { Prisma, prisma } from "@novachat/database";
import type {
  MetaEmbeddedSignupCallbackInput,
  MetaEmbeddedSignupCompleteInput,
  MetaEmbeddedSignupDisconnectInput,
  MetaEmbeddedSignupHealthCheckInput
} from "@novachat/shared-types";
import { env } from "../../config/env.js";
import { decryptSecret, encryptSecret } from "../../infrastructure/crypto/secret-crypto.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { MetaGraphClient } from "../../infrastructure/meta/meta-graph-client.js";
import { AppError, badRequest, forbidden, notFound, serviceUnavailable } from "../../shared/errors/app-error.js";

const metaGraphClient = new MetaGraphClient();

type MetaChecklistItem = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
};

function maskValue(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function expiryFromSeconds(seconds: number | undefined) {
  if (!seconds) return undefined;
  return new Date(Date.now() + seconds * 1000);
}

function serializedAccount(account: {
  id: string;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  displayName: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  wabaId: string | null;
  metaBusinessId: string | null;
  status: string;
  onboardingMethod: string;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastWebhookAt: Date | null;
  setupErrors: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: account.id,
    businessAccountId: maskValue(account.businessAccountId),
    phoneNumberId: account.phoneNumberId,
    displayPhoneNumber: account.displayPhoneNumber,
    displayName: account.displayName,
    verifiedName: account.verifiedName,
    qualityRating: account.qualityRating,
    wabaId: maskValue(account.wabaId),
    metaBusinessId: maskValue(account.metaBusinessId),
    status: account.status,
    onboardingMethod: account.onboardingMethod,
    connectedAt: account.connectedAt?.toISOString() ?? null,
    disconnectedAt: account.disconnectedAt?.toISOString() ?? null,
    lastHealthCheckAt: account.lastHealthCheckAt?.toISOString() ?? null,
    lastWebhookAt: account.lastWebhookAt?.toISOString() ?? null,
    setupErrors: account.setupErrors,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString()
  };
}

function onboardingStatus(status: string | undefined) {
  if (status === "CONNECTED") return "connected";
  if (status === "PENDING") return "pending";
  if (status === "DISCONNECTED" || status === "DISABLED") return "failed";
  return "not_connected";
}

export class MetaEmbeddedSignupService {
  config() {
    return {
      appId: env.META_APP_ID ?? null,
      configId: env.META_CONFIG_ID ?? null,
      apiVersion: env.META_API_VERSION,
      redirectUri: env.META_REDIRECT_URI ?? null,
      embeddedSignupEnabled: env.META_EMBEDDED_SIGNUP_ENABLED && metaGraphClient.isConfigured
    };
  }

  async callback(tenantId: string, input: MetaEmbeddedSignupCallbackInput, actorUserId?: string | null) {
    if (!env.META_EMBEDDED_SIGNUP_ENABLED) {
      throw serviceUnavailable("META_EMBEDDED_SIGNUP_DISABLED", "Meta Embedded Signup is not enabled.");
    }

    let accessToken = input.accessToken;
    let expiresIn = input.expiresIn;
    const phoneNumberId = input.phoneNumberId ?? this.extractString(input.rawResult, ["phone_number_id", "phoneNumberId"]);
    const wabaId = input.wabaId ?? this.extractString(input.rawResult, ["waba_id", "wabaId", "whatsapp_business_account_id"]);
    const metaBusinessId = input.businessId ?? this.extractString(input.rawResult, ["business_id", "businessId"]);

    logger.info(
      {
        tenantId,
        hasCode: Boolean(input.code),
        hasAccessToken: Boolean(input.accessToken),
        hasSystemUserToken: Boolean(env.META_SYSTEM_USER_ACCESS_TOKEN),
        hasPhoneNumberId: Boolean(phoneNumberId),
        hasWabaId: Boolean(wabaId),
        hasBusinessId: Boolean(metaBusinessId)
      },
      "Meta Embedded Signup callback received"
    );

    if (input.code) {
      try {
        const exchanged = await metaGraphClient.exchangeCodeForAccessToken(input.code);
        accessToken = exchanged.accessToken;
        expiresIn = exchanged.expiresIn ?? expiresIn;
      } catch (error) {
        if (env.META_SYSTEM_USER_ACCESS_TOKEN && this.isMetaCodeExchangeError(error)) {
          logger.warn(
            {
              tenantId,
              hasPhoneNumberId: Boolean(phoneNumberId),
              hasWabaId: Boolean(wabaId)
            },
            "Meta authorization code exchange failed; using configured system user token fallback"
          );
          accessToken = env.META_SYSTEM_USER_ACCESS_TOKEN;
        } else {
          throw error;
        }
      }
    }

    if (!accessToken) {
      throw badRequest("Meta callback did not include a usable authorization code or access token.");
    }

    if (!phoneNumberId || !wabaId) {
      throw badRequest(
        "Meta callback is missing phoneNumberId or wabaId. Confirm the Embedded Signup frontend sends the selected WhatsApp account result."
      );
    }

    const [phoneInfo, wabaInfo] = await Promise.all([
      metaGraphClient.getPhoneNumber(phoneNumberId, accessToken).catch(() => null),
      metaGraphClient.getWhatsAppBusinessAccount(wabaId, accessToken).catch(() => null)
    ]);

    const displayPhoneNumber = input.displayPhoneNumber ?? phoneInfo?.display_phone_number ?? phoneNumberId;
    const verifiedName = input.verifiedName ?? phoneInfo?.verified_name ?? null;
    const displayName = verifiedName ?? wabaInfo?.name ?? displayPhoneNumber;
    const qualityRating = input.qualityRating ?? phoneInfo?.quality_rating ?? null;
    const tokenExpiresAt = expiryFromSeconds(expiresIn) ?? null;
    const metaBusinessIdValue = metaBusinessId ?? null;

    const account = await prisma.$transaction(async (tx) => {
      const saved = await tx.whatsAppAccount.upsert({
        where: {
          tenantId_phoneNumberId: {
            tenantId,
            phoneNumberId
          }
        },
        update: {
          businessAccountId: wabaId,
          displayPhoneNumber,
          displayName,
          encryptedAccessToken: encryptSecret(accessToken),
          webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN ?? null,
          status: "PENDING",
          onboardingMethod: "EMBEDDED_SIGNUP",
          metaBusinessId: metaBusinessIdValue,
          wabaId,
          verifiedName,
          qualityRating,
          tokenExpiresAt,
          disconnectedAt: null,
          setupErrors: Prisma.JsonNull,
          rawOnboardingMetadata: (input.rawResult ?? {}) as Prisma.InputJsonValue,
          deletedAt: null
        },
        create: {
          tenantId,
          businessAccountId: wabaId,
          phoneNumberId,
          displayPhoneNumber,
          displayName,
          encryptedAccessToken: encryptSecret(accessToken),
          webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN ?? null,
          status: "PENDING",
          onboardingMethod: "EMBEDDED_SIGNUP",
          metaBusinessId: metaBusinessIdValue,
          wabaId,
          verifiedName,
          qualityRating,
          tokenExpiresAt,
          rawOnboardingMetadata: (input.rawResult ?? {}) as Prisma.InputJsonValue
        }
      });

      await tx.metaConnectionLog.create({
        data: {
          tenantId,
          whatsappAccountId: saved.id,
          eventType: "embedded_signup_callback",
          status: "PENDING",
          message: "Embedded Signup callback received and token saved securely.",
          metadata: {
            phoneNumberId,
            wabaId,
            metaBusinessId: metaBusinessIdValue,
            hasToken: true
          }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actorUserId ?? null,
          action: "whatsapp.embedded_signup_callback",
          entityType: "WhatsAppAccount",
          entityId: saved.id,
          metadata: { phoneNumberId, wabaId, metaBusinessId: metaBusinessIdValue }
        }
      });

      return saved;
    });

    return {
      account: serializedAccount(account),
      nextStep: "complete"
    };
  }

  async complete(tenantId: string, input: MetaEmbeddedSignupCompleteInput, actorUserId?: string | null) {
    const health = await this.healthCheck(tenantId, { accountId: input.accountId });
    const account = await prisma.whatsAppAccount.update({
      where: { id: input.accountId },
      data: {
        status: health.ready ? "CONNECTED" : "PENDING",
        connectedAt: health.ready ? new Date() : null,
        setupErrors: health.ready ? Prisma.JsonNull : (health.checklist as unknown as Prisma.InputJsonValue)
      }
    });

    await prisma.metaConnectionLog.create({
      data: {
        tenantId,
        whatsappAccountId: account.id,
        eventType: "embedded_signup_completed",
        status: health.ready ? "SUCCESS" : "FAILED",
        message: health.ready
          ? "Embedded Signup completed and health check passed."
          : "Embedded Signup completed but health check needs review.",
        metadata: { checklist: health.checklist }
      }
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: actorUserId ?? null,
        action: health.ready ? "whatsapp.embedded_signup_completed" : "whatsapp.health_check_failed",
        entityType: "WhatsAppAccount",
        entityId: account.id,
        metadata: { checklist: health.checklist }
      }
    });

    return {
      account: serializedAccount(account),
      health
    };
  }

  async disconnect(tenantId: string, input: MetaEmbeddedSignupDisconnectInput, actorUserId?: string | null) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: input.accountId, tenantId, deletedAt: null }
    });

    if (!account) {
      throw notFound("WhatsApp account not found");
    }

    const disconnected = await prisma.$transaction(async (tx) => {
      const saved = await tx.whatsAppAccount.update({
        where: { id: account.id },
        data: {
          status: "DISCONNECTED",
          disconnectedAt: new Date(),
          encryptedAccessToken: null
        }
      });

      await tx.metaConnectionLog.create({
        data: {
          tenantId,
          whatsappAccountId: saved.id,
          eventType: "whatsapp_account_disconnected",
          status: "SUCCESS",
          message: "WhatsApp account disconnected. Message history was retained.",
          metadata: { reason: input.reason ?? null }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actorUserId ?? null,
          action: "whatsapp.account_disconnected",
          entityType: "WhatsAppAccount",
          entityId: saved.id,
          metadata: { reason: input.reason ?? null }
        }
      });

      return saved;
    });

    return serializedAccount(disconnected);
  }

  async status(tenantId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: [{ onboardingMethod: "desc" }, { updatedAt: "desc" }]
    });

    if (!account) {
      return {
        status: "not_connected",
        account: null,
        latestLog: null
      };
    }

    const latestLog = await prisma.metaConnectionLog.findFirst({
      where: { tenantId, whatsappAccountId: account.id },
      orderBy: { createdAt: "desc" }
    });

    return {
      status: onboardingStatus(account.status),
      account: serializedAccount(account),
      latestLog: latestLog
        ? {
            eventType: latestLog.eventType,
            status: latestLog.status,
            message: latestLog.message,
            metadata: latestLog.metadata,
            createdAt: latestLog.createdAt.toISOString()
          }
        : null
    };
  }

  async healthCheck(tenantId: string, input: MetaEmbeddedSignupHealthCheckInput) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        tenantId,
        ...(input.accountId ? { id: input.accountId } : {}),
        deletedAt: null
      },
      orderBy: { updatedAt: "desc" }
    });

    if (!account) {
      throw notFound("WhatsApp account not found");
    }

    const checklist: MetaChecklistItem[] = [
      {
        key: "meta_app_configured",
        label: "Meta app configured",
        ok: metaGraphClient.isConfigured,
        detail: metaGraphClient.isConfigured ? "Meta app environment variables are present." : "Missing Meta app environment variables."
      },
      {
        key: "token_saved_securely",
        label: "Token saved securely",
        ok: Boolean(account.encryptedAccessToken),
        detail: account.encryptedAccessToken ? "Encrypted access token is stored at rest." : "No access token is available."
      },
      {
        key: "webhook_verify_token",
        label: "Webhook verify token configured",
        ok: Boolean(account.webhookVerifyToken ?? env.META_WEBHOOK_VERIFY_TOKEN),
        detail: account.webhookVerifyToken ?? env.META_WEBHOOK_VERIFY_TOKEN ? "Verify token is configured." : "Webhook verify token is missing."
      },
      {
        key: "last_webhook_received",
        label: "Last webhook received",
        ok: Boolean(account.lastWebhookAt),
        detail: account.lastWebhookAt ? account.lastWebhookAt.toISOString() : "No webhook has been received yet."
      }
    ];

    if (account.encryptedAccessToken) {
      try {
        const token = decryptSecret(account.encryptedAccessToken);
        const phone = await metaGraphClient.getPhoneNumber(account.phoneNumberId, token);
        checklist.push({
          key: "phone_number_access",
          label: "Phone number access verified",
          ok: phone.id === account.phoneNumberId,
          detail: phone.display_phone_number ?? phone.id
        });

        if (account.wabaId) {
          await metaGraphClient.subscribeAppToWaba(account.wabaId, token);
          checklist.push({
            key: "webhook_subscription",
            label: "Webhook subscription requested",
            ok: true,
            detail: "Meta accepted the WABA subscribed_apps request."
          });
        }
      } catch (error) {
        checklist.push({
          key: "meta_graph_access",
          label: "Meta Graph account access",
          ok: false,
          detail: error instanceof Error ? error.message : "Could not verify Meta Graph access."
        });
      }
    }

    const ready = checklist.filter((item) => item.key !== "last_webhook_received").every((item) => item.ok);

    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: {
        lastHealthCheckAt: new Date(),
        setupErrors: ready ? Prisma.JsonNull : (checklist.filter((item) => !item.ok) as unknown as Prisma.InputJsonValue)
      }
    });

    await prisma.metaConnectionLog.create({
      data: {
        tenantId,
        whatsappAccountId: account.id,
        eventType: "health_check",
        status: ready ? "SUCCESS" : "FAILED",
        message: ready ? "WhatsApp connection health check passed." : "WhatsApp connection health check needs review.",
        metadata: { checklist }
      }
    });

    return {
      ready,
      status: ready ? "connected" : "needs_review",
      account: serializedAccount(account),
      checklist
    };
  }

  async adminStatusOverride(tenantId: string, accountId: string, status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "DISABLED", actorUserId?: string | null) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, tenantId, deletedAt: null }
    });

    if (!account) throw notFound("WhatsApp account not found");

    const saved = await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { status }
    });

    await prisma.metaConnectionLog.create({
      data: {
        tenantId,
        whatsappAccountId: account.id,
        eventType: "admin_connection_status_override",
        status: "SUCCESS",
        message: `Super Admin changed WhatsApp connection status to ${status}.`,
        metadata: { status }
      }
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: actorUserId ?? null,
        action: "platform.whatsapp_status_override",
        entityType: "WhatsAppAccount",
        entityId: account.id,
        metadata: { status }
      }
    });

    return serializedAccount(saved);
  }

  private extractString(value: unknown, keys: string[]): string | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    for (const key of keys) {
      const directValue = (value as Record<string, unknown>)[key];
      if (typeof directValue === "string" && directValue.trim()) {
        return directValue.trim();
      }
    }

    const nestedValues = Object.values(value as Record<string, unknown>);
    for (const nested of nestedValues) {
      const result: string | undefined = this.extractString(nested, keys);
      if (result) return result;
    }

    return undefined;
  }

  private isMetaCodeExchangeError(error: unknown) {
    return error instanceof AppError && error.code === "META_GRAPH_REQUEST_FAILED";
  }

  assertAdminTenantAccess(userIsSuperAdmin: boolean | undefined) {
    if (!userIsSuperAdmin) {
      throw forbidden("Super admin access is required");
    }
  }
}

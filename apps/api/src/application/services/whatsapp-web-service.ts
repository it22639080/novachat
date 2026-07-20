import { Prisma, prisma } from "@novachat/database";
import type { WhatsAppWebConnectInput, WhatsAppWebDisconnectInput } from "@novachat/shared-types";
import { env } from "../../config/env.js";
import { whatsAppWebSessionManager } from "../../infrastructure/whatsapp-web/whatsapp-web-session-manager.js";
import { badRequest, serviceUnavailable } from "../../shared/errors/app-error.js";

function featureEnabled() {
  if (!env.ENABLE_EXPERIMENTAL_WHATSAPP_WEB) {
    throw serviceUnavailable(
      "WHATSAPP_WEB_EXPERIMENTAL_DISABLED",
      "WhatsApp Web experimental provider is disabled for this environment."
    );
  }
}

function serializeSession(
  session: Prisma.WhatsAppWebSessionGetPayload<{
    include: { whatsappAccount: true };
  }> | null
) {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    providerType: session.providerType,
    status: session.status,
    displayNumber: session.displayNumber,
    displayName: session.displayName,
    explicitDisconnect: session.explicitDisconnect,
    lastConnectedAt: session.lastConnectedAt?.toISOString() ?? null,
    lastDisconnectedAt: session.lastDisconnectedAt?.toISOString() ?? null,
    lastHeartbeatAt: session.lastHeartbeatAt?.toISOString() ?? null,
    reconnectAttempts: session.reconnectAttempts,
    failureReason: session.failureReason,
    account: session.whatsappAccount
      ? {
          id: session.whatsappAccount.id,
          displayName: session.whatsappAccount.displayName,
          displayPhoneNumber: session.whatsappAccount.displayPhoneNumber,
          status: session.whatsappAccount.status,
          onboardingMethod: session.whatsappAccount.onboardingMethod,
          lastWebhookAt: session.whatsappAccount.lastWebhookAt?.toISOString() ?? null
        }
      : null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}

export class WhatsAppWebService {
  async status(tenantId: string) {
    if (!env.ENABLE_EXPERIMENTAL_WHATSAPP_WEB) {
      return {
        enabled: false,
        qrTtlSeconds: env.WHATSAPP_WEB_QR_TTL_SECONDS,
        session: null
      };
    }

    let session: Prisma.WhatsAppWebSessionGetPayload<{
      include: { whatsappAccount: true };
    }> | null;

    try {
      session = await prisma.whatsAppWebSession.findFirst({
        where: { tenantId, deletedAt: null },
        include: { whatsappAccount: true },
        orderBy: { createdAt: "desc" }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
        throw serviceUnavailable(
          "WHATSAPP_WEB_DATABASE_NOT_MIGRATED",
          "WhatsApp Web database tables are missing. Run the latest Prisma migration before enabling this provider."
        );
      }

      throw error;
    }

    return {
      enabled: env.ENABLE_EXPERIMENTAL_WHATSAPP_WEB,
      qrTtlSeconds: env.WHATSAPP_WEB_QR_TTL_SECONDS,
      session: serializeSession(session)
    };
  }

  async connect(tenantId: string, userId: string, input: WhatsAppWebConnectInput) {
    featureEnabled();
    if (!input.acknowledgementAccepted) {
      throw badRequest("Please acknowledge that WhatsApp Web is experimental before connecting.");
    }

    const session = await whatsAppWebSessionManager.getOrCreateTenantSession(tenantId);
    await whatsAppWebSessionManager.connect({ tenantId, connectionId: session.id, userId });
    return this.status(tenantId);
  }

  async reconnect(tenantId: string, userId: string) {
    featureEnabled();
    const session = await whatsAppWebSessionManager.getOrCreateTenantSession(tenantId);
    await whatsAppWebSessionManager.reconnect({ tenantId, connectionId: session.id, userId });
    return this.status(tenantId);
  }

  async disconnect(tenantId: string, input: WhatsAppWebDisconnectInput) {
    featureEnabled();
    const session = await whatsAppWebSessionManager.getOrCreateTenantSession(tenantId);
    await whatsAppWebSessionManager.disconnect({
      tenantId,
      connectionId: session.id,
      deleteSession: input.deleteSession
    });
    return this.status(tenantId);
  }

  async logout(tenantId: string) {
    featureEnabled();
    const session = await whatsAppWebSessionManager.getOrCreateTenantSession(tenantId);
    await whatsAppWebSessionManager.disconnect({
      tenantId,
      connectionId: session.id,
      deleteSession: true
    });
    return this.status(tenantId);
  }
}

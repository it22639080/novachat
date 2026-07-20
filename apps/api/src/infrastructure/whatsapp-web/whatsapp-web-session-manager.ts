import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@novachat/database";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  type ConnectionState,
  type WAMessage,
  type WASocket
} from "@whiskeysockets/baileys";
import { env } from "../../config/env.js";
import { AiAssistantEngineService } from "../../application/services/ai-assistant-engine-service.js";
import { MessageProcessingService } from "../../application/services/message-processing-service.js";
import { badRequest, notFound, serviceUnavailable } from "../../shared/errors/app-error.js";
import { logger } from "../logger/logger.js";
import { publishTenantEvent, publishTenantUserEvent } from "../realtime/realtime.js";
import { redisConnection } from "../redis/redis.js";
import { WhatsAppWebAuthStore } from "./whatsapp-web-auth-store.js";

type ManagedSession = {
  tenantId: string;
  connectionId: string;
  ownerUserId: string | undefined;
  socket: WASocket;
  authStore: WhatsAppWebAuthStore;
  heartbeat?: NodeJS.Timeout;
  reconnectTimer?: NodeJS.Timeout;
  shuttingDown: boolean;
};

type IncomingWebMessage = {
  externalMessageId: string;
  remoteJid: string;
  senderPhone: string;
  text: string;
  timestamp: Date;
};

const instanceId = `${process.env.RAILWAY_DEPLOYMENT_ID ?? "local"}:${process.pid}:${randomUUID()}`;
const messageProcessingService = new MessageProcessingService();
const aiAssistantEngineService = new AiAssistantEngineService();

function lockKey(connectionId: string) {
  return `whatsapp-web:session-lock:${connectionId}`;
}

function messageLockKey(connectionId: string, messageId: string) {
  return `whatsapp-web:message:${connectionId}:${messageId}`;
}

function rateLimitKey(tenantId: string, connectionId: string) {
  const minute = Math.floor(Date.now() / 60_000);
  return `whatsapp-web:send-rate:${tenantId}:${connectionId}:${minute}`;
}

function normalizePhone(value: string) {
  return value.replace(/@s\.whatsapp\.net$/i, "").replace(/[^\d+]/g, "");
}

function recipientJid(recipient: string) {
  return `${normalizePhone(recipient)}@s.whatsapp.net`;
}

function extractText(message: WAMessage) {
  const content = message.message;
  if (!content) return null;

  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    null
  );
}

function shouldIgnoreMessage(message: WAMessage) {
  const remoteJid = message.key.remoteJid ?? "";

  return (
    Boolean(message.key.fromMe) ||
    !remoteJid ||
    remoteJid === "status@broadcast" ||
    remoteJid.endsWith("@g.us") ||
    remoteJid.endsWith("@newsletter") ||
    remoteJid.includes("broadcast") ||
    Boolean(message.messageStubType) ||
    !message.message
  );
}

function statusFromDisconnectCode(code: number | undefined) {
  if (code === DisconnectReason.loggedOut) return "SESSION_EXPIRED";
  if (code === DisconnectReason.badSession || code === DisconnectReason.forbidden) return "AUTH_FAILURE";
  return "RECONNECTING";
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "WhatsApp Web provider failed";
}

export class WhatsAppWebSessionManager {
  private readonly sessions = new Map<string, ManagedSession>();

  async getOrCreateTenantSession(tenantId: string) {
    const existing = await prisma.whatsAppWebSession.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });

    if (existing) return existing;

    return prisma.whatsAppWebSession.create({
      data: {
        tenantId,
        status: "DISCONNECTED",
        explicitDisconnect: true
      }
    });
  }

  async connect(input: { tenantId: string; connectionId: string; userId?: string }) {
    this.assertEnabled();

    if (this.sessions.has(input.connectionId)) {
      await this.updateStatus(input.tenantId, input.connectionId, "CONNECTING", null);
      return;
    }

    if (this.sessions.size >= env.WHATSAPP_WEB_MAX_SESSIONS_PER_INSTANCE) {
      throw serviceUnavailable(
        "WHATSAPP_WEB_SESSION_LIMIT",
        "This API instance reached its local WhatsApp Web session limit."
      );
    }

    const lockAcquired = await redisConnection.set(lockKey(input.connectionId), instanceId, "EX", 90, "NX");
    if (lockAcquired !== "OK") {
      throw serviceUnavailable("WHATSAPP_WEB_SESSION_LOCKED", "This WhatsApp Web session is already running.");
    }

    await prisma.whatsAppWebSession.updateMany({
      where: { id: input.connectionId, tenantId: input.tenantId, deletedAt: null },
      data: {
        status: "INITIALIZING",
        explicitDisconnect: false,
        connectedInstanceId: instanceId,
        failureReason: null
      }
    });

    const authStore = await WhatsAppWebAuthStore.create(input.tenantId, input.connectionId);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1023223821] as [number, number, number]
    }));

    const socket = makeWASocket({
      auth: authStore.authenticationState,
      browser: Browsers.appropriate("NovaChat AI"),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      version,
      logger: logger.child({ provider: "whatsapp-web-experimental" }) as never
    });

    const managed: ManagedSession = {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      ownerUserId: input.userId,
      socket,
      authStore,
      shuttingDown: false
    };

    this.sessions.set(input.connectionId, managed);
    this.startHeartbeat(managed);

    socket.ev.on("creds.update", (update) => {
      void authStore.updateCredentials(update).catch((error) => {
        logger.error({ err: error, tenantId: input.tenantId, connectionId: input.connectionId }, "Failed to persist WhatsApp Web credentials");
      });
    });

    socket.ev.on("connection.update", (update) => {
      void this.handleConnectionUpdate(managed, update).catch((error) => {
        logger.error({ err: error, tenantId: input.tenantId, connectionId: input.connectionId }, "WhatsApp Web connection update failed");
      });
    });

    socket.ev.on("messages.upsert", (event) => {
      void Promise.all(event.messages.map((message) => this.handleIncomingMessage(managed, message))).catch((error) => {
        logger.error({ err: error, tenantId: input.tenantId, connectionId: input.connectionId }, "WhatsApp Web incoming message failed");
      });
    });
  }

  async reconnect(input: { tenantId: string; connectionId: string; userId?: string }) {
    await this.disconnect({ tenantId: input.tenantId, connectionId: input.connectionId, preserveExplicitDisconnect: true });
    await this.connect(input);
  }

  async disconnect(input: {
    tenantId: string;
    connectionId: string;
    deleteSession?: boolean;
    preserveExplicitDisconnect?: boolean;
  }) {
    const managed = this.sessions.get(input.connectionId);
    if (managed) {
      managed.shuttingDown = true;
      if (managed.heartbeat) clearInterval(managed.heartbeat);
      if (managed.reconnectTimer) clearTimeout(managed.reconnectTimer);
      managed.socket.ev.removeAllListeners("connection.update");
      managed.socket.ev.removeAllListeners("messages.upsert");
      managed.socket.ev.removeAllListeners("creds.update");

      if (input.deleteSession) {
        await managed.socket.logout().catch(() => undefined);
        await managed.authStore.delete();
      } else {
        managed.socket.end(undefined);
      }

      this.sessions.delete(input.connectionId);
    }

    await redisConnection.del(lockKey(input.connectionId));
    const updateData: Prisma.WhatsAppWebSessionUncheckedUpdateManyInput = {
      status: input.deleteSession ? "SESSION_EXPIRED" : "DISCONNECTED",
      connectedInstanceId: null,
      lastDisconnectedAt: new Date()
    };
    if (!input.preserveExplicitDisconnect) {
      updateData.explicitDisconnect = true;
    }
    if (input.deleteSession) {
      updateData.encryptedSessionState = null;
      updateData.whatsappAccountId = null;
    }

    await prisma.whatsAppWebSession.updateMany({
      where: { id: input.connectionId, tenantId: input.tenantId, deletedAt: null },
      data: updateData
    });

    publishTenantEvent(input.tenantId, "whatsapp.web.disconnected", {
      connectionId: input.connectionId,
      status: input.deleteSession ? "SESSION_EXPIRED" : "DISCONNECTED"
    });
  }

  async getStatus(input: { tenantId: string; connectionId: string }) {
    const session = await prisma.whatsAppWebSession.findFirst({
      where: { id: input.connectionId, tenantId: input.tenantId, deletedAt: null }
    });

    if (!session) throw notFound("WhatsApp Web session not found");

    return session.status;
  }

  async sendText(input: {
    tenantId: string;
    connectionId: string;
    recipient: string;
    text: string;
    internalMessageId: string;
  }) {
    this.assertEnabled();
    await this.assertSendRateLimit(input.tenantId, input.connectionId);
    let managed = this.sessions.get(input.connectionId);

    if (!managed) {
      await this.connect({ tenantId: input.tenantId, connectionId: input.connectionId });
      managed = this.sessions.get(input.connectionId);
    }

    if (!managed) {
      throw serviceUnavailable("WHATSAPP_WEB_SESSION_NOT_RUNNING", "WhatsApp Web session is not running.");
    }

    const sessionStatus = await this.getStatus(input);
    if (sessionStatus !== "CONNECTED") {
      throw serviceUnavailable("WHATSAPP_WEB_NOT_CONNECTED", "WhatsApp Web session is not connected.");
    }

    const response = await managed.socket.sendMessage(recipientJid(input.recipient), { text: input.text });

    return {
      providerMessageId: response?.key.id ?? null,
      rawResponse: {
        jid: response?.key.remoteJid,
        messageId: response?.key.id
      }
    };
  }

  async restoreEligibleSessions() {
    if (!env.ENABLE_EXPERIMENTAL_WHATSAPP_WEB) {
      return;
    }

    let sessions: Array<{ id: string; tenantId: string }>;

    try {
      sessions = await prisma.whatsAppWebSession.findMany({
        where: {
          deletedAt: null,
          encryptedSessionState: { not: null },
          explicitDisconnect: false,
          status: { in: ["CONNECTED", "RECONNECTING", "ERROR", "DISCONNECTED"] }
        },
        take: env.WHATSAPP_WEB_MAX_SESSIONS_PER_INSTANCE
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
        logger.warn(
          { table: error.meta?.table },
          "WhatsApp Web session restoration skipped because database migration is not applied"
        );
        return;
      }

      throw error;
    }

    for (const session of sessions) {
      await this.connect({ tenantId: session.tenantId, connectionId: session.id }).catch((error) => {
        logger.error({ err: error, tenantId: session.tenantId, connectionId: session.id }, "Failed to restore WhatsApp Web session");
      });
    }
  }

  async shutdown() {
    await Promise.all(
      Array.from(this.sessions.values()).map((session) =>
        this.disconnect({
          tenantId: session.tenantId,
          connectionId: session.connectionId,
          preserveExplicitDisconnect: true
        }).catch((error) => {
          logger.error({ err: error, connectionId: session.connectionId }, "WhatsApp Web session shutdown failed");
        })
      )
    );
  }

  private async handleConnectionUpdate(managed: ManagedSession, update: Partial<ConnectionState>) {
    if (update.qr) {
      await this.updateStatus(managed.tenantId, managed.connectionId, "QR_REQUIRED", null);
      if (managed.ownerUserId) {
        publishTenantUserEvent(managed.tenantId, managed.ownerUserId, "whatsapp.web.qr", {
          connectionId: managed.connectionId,
          qr: update.qr,
          expiresAt: new Date(Date.now() + env.WHATSAPP_WEB_QR_TTL_SECONDS * 1000).toISOString()
        });
      }
      return;
    }

    if (update.connection === "connecting") {
      await this.updateStatus(managed.tenantId, managed.connectionId, "CONNECTING", null);
      return;
    }

    if (update.connection === "open") {
      const normalizedJid = jidNormalizedUser(managed.socket.user?.id);
      const displayNumber = normalizePhone(normalizedJid);
      const displayName = managed.socket.user?.name ?? "WhatsApp Web";
      const account = await this.upsertLinkedAccount(managed.tenantId, managed.connectionId, displayNumber, displayName);

      await prisma.whatsAppWebSession.update({
        where: { id: managed.connectionId },
        data: {
          status: "CONNECTED",
          displayNumber,
          displayName,
          whatsappAccountId: account.id,
          connectedInstanceId: instanceId,
          lastConnectedAt: new Date(),
          lastHeartbeatAt: new Date(),
          reconnectAttempts: 0,
          failureReason: null
        }
      });

      publishTenantEvent(managed.tenantId, "whatsapp.web.connected", {
        connectionId: managed.connectionId,
        status: "CONNECTED",
        displayNumber,
        displayName
      });
      return;
    }

    if (update.connection === "close") {
      const code = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      const status = statusFromDisconnectCode(code);
      const errorMessage = safeErrorMessage(update.lastDisconnect?.error);

      await this.updateStatus(managed.tenantId, managed.connectionId, status, errorMessage);
      this.sessions.delete(managed.connectionId);
      await redisConnection.del(lockKey(managed.connectionId));

      if (managed.shuttingDown || status === "SESSION_EXPIRED" || status === "AUTH_FAILURE") {
        return;
      }

      const persisted = await prisma.whatsAppWebSession.findFirst({
        where: { id: managed.connectionId, tenantId: managed.tenantId, deletedAt: null }
      });

      if (!persisted || persisted.explicitDisconnect || persisted.reconnectAttempts >= env.WHATSAPP_WEB_MAX_RECONNECT_ATTEMPTS) {
        return;
      }

      await prisma.whatsAppWebSession.update({
        where: { id: managed.connectionId },
        data: { reconnectAttempts: { increment: 1 } }
      });

      managed.reconnectTimer = setTimeout(() => {
        void this.connect({
          tenantId: managed.tenantId,
          connectionId: managed.connectionId,
          ...(managed.ownerUserId ? { userId: managed.ownerUserId } : {})
        });
      }, 3000);
    }
  }

  private async handleIncomingMessage(managed: ManagedSession, message: WAMessage) {
    const normalized = this.normalizeIncomingMessage(message);
    if (!normalized) return;

    const lockAcquired = await redisConnection.set(
      messageLockKey(managed.connectionId, normalized.externalMessageId),
      "processing",
      "EX",
      86_400,
      "NX"
    );
    if (lockAcquired !== "OK") return;

    const account = await this.upsertLinkedAccount(managed.tenantId, managed.connectionId);
    const existing = await prisma.message.findFirst({
      where: {
        tenantId: managed.tenantId,
        externalId: `waweb:${managed.connectionId}:${normalized.externalMessageId}`
      },
      select: { id: true }
    });
    if (existing) return;

    const processed = await messageProcessingService.processIncoming({
      tenantId: managed.tenantId,
      whatsappAccountId: account.id,
      phone: normalized.senderPhone,
      whatsappWaId: normalized.remoteJid,
      type: "text",
      text: normalized.text,
      source: "whatsapp",
      providerName: "whatsapp-web-experimental",
      externalId: `waweb:${managed.connectionId}:${normalized.externalMessageId}`,
      rawPayload: {
        remoteJid: normalized.remoteJid,
        messageTimestamp: normalized.timestamp.toISOString()
      }
    });

    await aiAssistantEngineService.handleIncomingMessage({
      tenantId: managed.tenantId,
      conversationId: processed.conversation.id,
      source: "whatsapp"
    });
  }

  private normalizeIncomingMessage(message: WAMessage): IncomingWebMessage | null {
    if (shouldIgnoreMessage(message)) return null;
    const remoteJid = message.key.remoteJid ?? "";
    const id = message.key.id;
    const text = extractText(message)?.trim();
    if (!id || !text) return null;

    const timestampSeconds =
      typeof message.messageTimestamp === "number"
        ? message.messageTimestamp
        : Number(message.messageTimestamp ?? Math.floor(Date.now() / 1000));

    return {
      externalMessageId: id,
      remoteJid,
      senderPhone: normalizePhone(remoteJid),
      text,
      timestamp: new Date(timestampSeconds * 1000)
    };
  }

  private async upsertLinkedAccount(
    tenantId: string,
    connectionId: string,
    displayNumber = "unknown",
    displayName = "WhatsApp Web"
  ) {
    return prisma.whatsAppAccount.upsert({
      where: {
        tenantId_phoneNumberId: {
          tenantId,
          phoneNumberId: `waweb:${connectionId}`
        }
      },
      update: {
        displayPhoneNumber: displayNumber,
        displayName,
        status: "CONNECTED",
        onboardingMethod: "WHATSAPP_WEB_EXPERIMENTAL",
        connectedAt: new Date()
      },
      create: {
        tenantId,
        businessAccountId: "whatsapp-web-experimental",
        phoneNumberId: `waweb:${connectionId}`,
        displayPhoneNumber: displayNumber,
        displayName,
        status: "CONNECTED",
        onboardingMethod: "WHATSAPP_WEB_EXPERIMENTAL",
        connectedAt: new Date()
      }
    });
  }

  private startHeartbeat(managed: ManagedSession) {
    managed.heartbeat = setInterval(() => {
      void redisConnection.expire(lockKey(managed.connectionId), 90);
      void prisma.whatsAppWebSession.updateMany({
        where: { id: managed.connectionId, tenantId: managed.tenantId, deletedAt: null },
        data: { lastHeartbeatAt: new Date(), connectedInstanceId: instanceId }
      });
    }, 30_000);
  }

  private async updateStatus(
    tenantId: string,
    connectionId: string,
    status: "INITIALIZING" | "QR_REQUIRED" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "SESSION_EXPIRED" | "AUTH_FAILURE" | "ERROR",
    failureReason: string | null
  ) {
    await prisma.whatsAppWebSession.updateMany({
      where: { id: connectionId, tenantId, deletedAt: null },
      data: {
        status,
        failureReason,
        lastHeartbeatAt: new Date(),
        ...(status === "SESSION_EXPIRED" || status === "AUTH_FAILURE" || status === "ERROR"
          ? { lastDisconnectedAt: new Date() }
          : {})
      }
    });

    publishTenantEvent(tenantId, "whatsapp.web.status", {
      connectionId,
      status,
      failureReason
    });

    if (failureReason) {
      publishTenantEvent(tenantId, "whatsapp.web.error", {
        connectionId,
        status,
        message: failureReason
      });
    }
  }

  private assertEnabled() {
    if (!env.ENABLE_EXPERIMENTAL_WHATSAPP_WEB) {
      throw badRequest("WhatsApp Web experimental provider is disabled.");
    }
  }

  private async assertSendRateLimit(tenantId: string, connectionId: string) {
    const key = rateLimitKey(tenantId, connectionId);
    const count = await redisConnection.incr(key);
    if (count === 1) {
      await redisConnection.expire(key, 65);
    }

    if (count > env.WHATSAPP_WEB_MESSAGE_RATE_LIMIT_PER_MINUTE) {
      throw serviceUnavailable("WHATSAPP_WEB_RATE_LIMITED", "WhatsApp Web experimental send rate limit reached.");
    }
  }
}

export const whatsAppWebSessionManager = new WhatsAppWebSessionManager();

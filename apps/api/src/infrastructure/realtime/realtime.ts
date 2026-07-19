import { createServer, type RequestListener } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import type { Server as HttpServer } from "node:http";
import { env } from "../../config/env.js";
import { TokenService } from "../auth/token-service.js";
import { authCookieNames } from "../../shared/http/cookies.js";
import { logger } from "../logger/logger.js";

type TenantEvent =
  | "message:new"
  | "conversation:updated"
  | "conversation:assigned"
  | "message:read"
  | "note:created"
  | "whatsapp.web.status"
  | "whatsapp.web.connected"
  | "whatsapp.web.disconnected"
  | "whatsapp.web.error";

type TenantUserEvent = "whatsapp.web.qr" | TenantEvent;

const tokenService = new TokenService();

const socketPayloadSchema = z.object({
  sub: z.string().uuid(),
  tenantId: z.string().uuid(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "ADMIN", "MANAGER", "AGENT", "VIEWER"])
});

let io: Server | null = null;

function parseCookie(header: string | undefined, name: string) {
  if (!header) {
    return undefined;
  }

  return header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const cookieToken = parseCookie(socket.handshake.headers.cookie, authCookieNames.accessToken);
      const authToken =
        typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : undefined;
      const token = authToken ?? cookieToken;

      if (!token) {
        next(new Error("Authentication is required"));
        return;
      }

      const payload = socketPayloadSchema.parse(tokenService.verifyAccessToken(token));
      socket.data.userId = payload.sub;
      socket.data.tenantId = payload.tenantId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired authentication token"));
    }
  });

  io.on("connection", (socket) => {
    const tenantId = socket.data.tenantId as string;
    const userId = socket.data.userId as string;
    socket.join(tenantRoom(tenantId));
    socket.join(tenantUserRoom(tenantId, userId));
    logger.info({ socketId: socket.id, tenantId, userId }, "Realtime client connected");

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, tenantId, reason }, "Realtime client disconnected");
    });
  });

  return io;
}

export function publishTenantEvent(tenantId: string, event: TenantEvent, payload: unknown) {
  io?.to(tenantRoom(tenantId)).emit(event, payload);
}

export function publishTenantUserEvent(tenantId: string, userId: string, event: TenantUserEvent, payload: unknown) {
  io?.to(tenantUserRoom(tenantId, userId)).emit(event, payload);
}

export function createRealtimeServer(app: RequestListener) {
  const httpServer = createServer(app);
  initRealtime(httpServer);
  return httpServer;
}

function tenantRoom(tenantId: string) {
  return `tenant:${tenantId}`;
}

function tenantUserRoom(tenantId: string, userId: string) {
  return `tenant:${tenantId}:user:${userId}`;
}

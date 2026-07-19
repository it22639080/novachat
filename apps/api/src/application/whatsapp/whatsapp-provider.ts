export type WhatsAppProviderType = "META_CLOUD" | "WHATSAPP_WEB_EXPERIMENTAL";

export type ProviderConnectionStatus =
  | "DISCONNECTED"
  | "INITIALIZING"
  | "QR_REQUIRED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "SESSION_EXPIRED"
  | "AUTH_FAILURE"
  | "ERROR";

export type ProviderSendResult = {
  providerMessageId: string | null;
  rawResponse?: unknown;
};

export interface WhatsAppProvider {
  providerType: WhatsAppProviderType;

  connect(input: { tenantId: string; connectionId: string; userId?: string }): Promise<void>;

  disconnect(input: {
    tenantId: string;
    connectionId: string;
    deleteSession?: boolean;
  }): Promise<void>;

  reconnect(input: { tenantId: string; connectionId: string; userId?: string }): Promise<void>;

  getStatus(input: { tenantId: string; connectionId: string }): Promise<ProviderConnectionStatus>;

  sendText(input: {
    tenantId: string;
    connectionId: string;
    recipient: string;
    text: string;
    internalMessageId: string;
  }): Promise<ProviderSendResult>;
}

import { whatsAppWebSessionManager } from "../../infrastructure/whatsapp-web/whatsapp-web-session-manager.js";
import type { ProviderConnectionStatus, ProviderSendResult, WhatsAppProvider } from "./whatsapp-provider.js";

export class WhatsAppWebExperimentalProvider implements WhatsAppProvider {
  readonly providerType = "WHATSAPP_WEB_EXPERIMENTAL" as const;

  async connect(input: { tenantId: string; connectionId: string; userId?: string }) {
    await whatsAppWebSessionManager.connect(input);
  }

  async disconnect(input: { tenantId: string; connectionId: string; deleteSession?: boolean }) {
    await whatsAppWebSessionManager.disconnect(input);
  }

  async reconnect(input: { tenantId: string; connectionId: string; userId?: string }) {
    await whatsAppWebSessionManager.reconnect(input);
  }

  async getStatus(input: { tenantId: string; connectionId: string }): Promise<ProviderConnectionStatus> {
    return whatsAppWebSessionManager.getStatus(input);
  }

  async sendText(input: {
    tenantId: string;
    connectionId: string;
    recipient: string;
    text: string;
    internalMessageId: string;
  }): Promise<ProviderSendResult> {
    return whatsAppWebSessionManager.sendText(input);
  }
}

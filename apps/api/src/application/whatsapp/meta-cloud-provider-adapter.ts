import { prisma } from "@novachat/database";
import { decryptSecret } from "../../infrastructure/crypto/secret-crypto.js";
import { WhatsAppCloudClient } from "../../infrastructure/whatsapp/whatsapp-cloud-client.js";
import { notFound } from "../../shared/errors/app-error.js";
import type { ProviderConnectionStatus, ProviderSendResult, WhatsAppProvider } from "./whatsapp-provider.js";

const cloudClient = new WhatsAppCloudClient();

function normalizePhone(value: string) {
  return value.trim().replace(/[^\d+]/g, "");
}

export class MetaCloudProviderAdapter implements WhatsAppProvider {
  readonly providerType = "META_CLOUD" as const;

  async connect() {
    return undefined;
  }

  async reconnect() {
    return undefined;
  }

  async disconnect() {
    return undefined;
  }

  async getStatus(input: { tenantId: string; connectionId: string }): Promise<ProviderConnectionStatus> {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: input.connectionId, tenantId: input.tenantId, deletedAt: null }
    });

    if (!account) throw notFound("WhatsApp account not found");
    return account.status === "CONNECTED" ? "CONNECTED" : "DISCONNECTED";
  }

  async sendText(input: {
    tenantId: string;
    connectionId: string;
    recipient: string;
    text: string;
  }): Promise<ProviderSendResult> {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: input.connectionId, tenantId: input.tenantId, deletedAt: null }
    });

    if (!account?.encryptedAccessToken) {
      throw notFound("WhatsApp account or access token not found");
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(input.recipient),
      type: "text",
      text: {
        preview_url: false,
        body: input.text
      }
    };

    const response = await cloudClient.sendMessage({
      phoneNumberId: account.phoneNumberId,
      accessToken: decryptSecret(account.encryptedAccessToken),
      payload
    });

    return {
      providerMessageId: response?.messages?.[0]?.id ?? null,
      rawResponse: response
    };
  }
}

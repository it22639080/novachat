import { badRequest } from "../../shared/errors/app-error.js";
import { MetaCloudProviderAdapter } from "./meta-cloud-provider-adapter.js";
import { WhatsAppWebExperimentalProvider } from "./whatsapp-web-experimental-provider.js";
import type { WhatsAppProvider, WhatsAppProviderType } from "./whatsapp-provider.js";

const providers: Record<WhatsAppProviderType, WhatsAppProvider> = {
  META_CLOUD: new MetaCloudProviderAdapter(),
  WHATSAPP_WEB_EXPERIMENTAL: new WhatsAppWebExperimentalProvider()
};

export class WhatsAppProviderRegistry {
  get(providerType: WhatsAppProviderType) {
    const provider = providers[providerType];

    if (!provider) {
      throw badRequest(`Unsupported WhatsApp provider: ${providerType}`);
    }

    return provider;
  }
}

export const whatsAppProviderRegistry = new WhatsAppProviderRegistry();

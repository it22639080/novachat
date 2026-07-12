import { env } from "../../config/env.js";

type CloudMessagePayload = Record<string, unknown>;

type CloudMessageResponse = {
  messaging_product: "whatsapp";
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string; message_status?: string }>;
};

function messagesUrl(phoneNumberId: string) {
  return `https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class WhatsAppCloudClient {
  async sendMessage(params: {
    phoneNumberId: string;
    accessToken: string;
    payload: CloudMessagePayload;
  }) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(messagesUrl(params.phoneNumberId), {
          method: "POST",
          headers: {
            authorization: `Bearer ${params.accessToken}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(params.payload)
        });

        const body = (await response.json().catch(() => null)) as CloudMessageResponse | null;

        if (!response.ok) {
          lastError = new Error(`WhatsApp Cloud API send failed with status ${response.status}`);

          if (response.status >= 500 && attempt < 3) {
            await sleep(250 * attempt);
            continue;
          }

          throw lastError;
        }

        return body;
      } catch (error) {
        lastError = error;

        if (attempt < 3) {
          await sleep(250 * attempt);
          continue;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("WhatsApp Cloud API send failed");
  }
}

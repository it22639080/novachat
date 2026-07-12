import { Prisma, prisma } from "@novachat/database";
import type {
  CreateWhatsAppAccountInput,
  SendWhatsAppButtonsInput,
  SendWhatsAppListInput,
  SendWhatsAppMediaInput,
  SendWhatsAppTemplateInput,
  SendWhatsAppTextInput,
  UpdateWhatsAppAccountInput
} from "@novachat/shared-types";
import { WhatsAppCloudClient } from "../../infrastructure/whatsapp/whatsapp-cloud-client.js";
import { decryptSecret, encryptSecret } from "../../infrastructure/crypto/secret-crypto.js";
import { forbidden, notFound } from "../../shared/errors/app-error.js";
import { env } from "../../config/env.js";
import { AiAssistantEngineService } from "./ai-assistant-engine-service.js";
import { MessageProcessingService } from "./message-processing-service.js";
import { UsageService } from "./usage-service.js";
import { BillingService } from "./billing-service.js";

const cloudClient = new WhatsAppCloudClient();
const messageProcessingService = new MessageProcessingService();
const aiAssistantEngineService = new AiAssistantEngineService();
const usageService = new UsageService();
const billingService = new BillingService();

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          phone_number_id?: string;
          display_phone_number?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: {
            name?: string;
          };
        }>;
        messages?: Array<Record<string, unknown>>;
        statuses?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
};

function maskToken(encryptedAccessToken: string | null) {
  return encryptedAccessToken ? "************" : null;
}

function serializeAccount(account: {
  id: string;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  displayName: string | null;
  status: string;
  onboardingMethod?: string;
  wabaId?: string | null;
  metaBusinessId?: string | null;
  verifiedName?: string | null;
  qualityRating?: string | null;
  connectedAt?: Date | null;
  disconnectedAt?: Date | null;
  lastHealthCheckAt?: Date | null;
  lastWebhookAt?: Date | null;
  setupErrors?: Prisma.JsonValue | null;
  encryptedAccessToken: string | null;
  webhookVerifyToken: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastWebhook?: {
    messageId: string;
    receivedAt: string;
    payload: unknown;
  } | null;
}) {
  return {
    id: account.id,
    businessAccountId: account.businessAccountId,
    phoneNumberId: account.phoneNumberId,
    displayPhoneNumber: account.displayPhoneNumber,
    displayName: account.displayName,
    status: account.status,
    onboardingMethod: account.onboardingMethod ?? "MANUAL",
    wabaId: account.wabaId ?? null,
    metaBusinessId: account.metaBusinessId ?? null,
    verifiedName: account.verifiedName ?? null,
    qualityRating: account.qualityRating ?? null,
    connectedAt: account.connectedAt?.toISOString() ?? null,
    disconnectedAt: account.disconnectedAt?.toISOString() ?? null,
    lastHealthCheckAt: account.lastHealthCheckAt?.toISOString() ?? null,
    lastWebhookAt: account.lastWebhookAt?.toISOString() ?? null,
    setupErrors: account.setupErrors ?? null,
    hasAccessToken: Boolean(account.encryptedAccessToken),
    maskedAccessToken: maskToken(account.encryptedAccessToken),
    webhookVerifyToken: account.webhookVerifyToken ? "configured" : null,
    lastWebhook: account.lastWebhook ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString()
  };
}

function normalizePhone(phone: string) {
  return phone.trim().replace(/[^\d+]/g, "");
}

function webhookMessageText(message: Record<string, unknown>) {
  const type = String(message.type ?? "text");

  if (type === "text") {
    const text = message.text as { body?: string } | undefined;
    return text?.body;
  }

  if (type === "button") {
    const button = message.button as { text?: string } | undefined;
    return button?.text;
  }

  if (type === "interactive") {
    const interactive = message.interactive as
      | {
          button_reply?: { title?: string };
          list_reply?: { title?: string };
        }
      | undefined;
    return interactive?.button_reply?.title ?? interactive?.list_reply?.title;
  }

  const media = message[type] as { caption?: string } | undefined;
  return media?.caption;
}

function webhookMessageType(message: Record<string, unknown>) {
  const type = String(message.type ?? "text");

  if (type === "image") {
    return "image";
  }

  if (type === "document") {
    return "document";
  }

  if (type === "button") {
    return "button_reply";
  }

  if (type === "interactive") {
    const interactive = message.interactive as { type?: string } | undefined;
    return interactive?.type === "list_reply" ? "list_reply" : "button_reply";
  }

  return "text";
}

function mediaUrlFromWebhook(message: Record<string, unknown>) {
  const type = String(message.type ?? "text");
  const media = message[type] as { id?: string; link?: string } | undefined;

  return media?.link ?? media?.id;
}

function statusToMessageStatus(status: string) {
  if (status === "delivered") {
    return "DELIVERED";
  }

  if (status === "read") {
    return "READ";
  }

  if (status === "failed") {
    return "FAILED";
  }

  return "SENT";
}

export class WhatsAppService {
  async createAccount(tenantId: string, input: CreateWhatsAppAccountInput) {
    const existing = await prisma.whatsAppAccount.findUnique({
      where: { tenantId_phoneNumberId: { tenantId, phoneNumberId: input.phoneNumberId } },
      select: { id: true, deletedAt: true }
    });
    if (!existing || existing.deletedAt) {
      await billingService.assertPlanAllowance(tenantId, "whatsappAccounts");
    }

    const account = await prisma.whatsAppAccount.upsert({
      where: {
        tenantId_phoneNumberId: {
          tenantId,
          phoneNumberId: input.phoneNumberId
        }
      },
      update: {
        businessAccountId: input.businessAccountId,
        displayPhoneNumber: input.displayPhoneNumber,
        displayName: input.displayName ?? null,
        encryptedAccessToken: encryptSecret(input.accessToken),
        webhookVerifyToken: input.webhookVerifyToken,
        status: "PENDING",
        onboardingMethod: "MANUAL",
        wabaId: input.businessAccountId,
        deletedAt: null
      },
      create: {
        tenantId,
        businessAccountId: input.businessAccountId,
        phoneNumberId: input.phoneNumberId,
        displayPhoneNumber: input.displayPhoneNumber,
        displayName: input.displayName ?? null,
        encryptedAccessToken: encryptSecret(input.accessToken),
        webhookVerifyToken: input.webhookVerifyToken,
        status: "PENDING",
        onboardingMethod: "MANUAL",
        wabaId: input.businessAccountId
      }
    });

    return serializeAccount(account);
  }

  async listAccounts(tenantId: string) {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return Promise.all(
      accounts.map(async (account) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            tenantId,
            whatsappAccountId: account.id,
            metadata: {
              path: ["source"],
              equals: "whatsapp"
            }
          },
          select: {
            id: true,
            metadata: true,
            createdAt: true
          },
          orderBy: {
            createdAt: "desc"
          }
        });

        return serializeAccount({
          ...account,
          lastWebhook: lastMessage
            ? {
                messageId: lastMessage.id,
                receivedAt: lastMessage.createdAt.toISOString(),
                payload: lastMessage.metadata
              }
            : null
        });
      })
    );
  }

  async listWebhookLogs(tenantId: string) {
    const logs = await prisma.whatsAppWebhookLog.findMany({
      where: { tenantId },
      include: {
        whatsappAccount: {
          select: {
            id: true,
            displayName: true,
            displayPhoneNumber: true,
            phoneNumberId: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return logs.map((log) => ({
      id: log.id,
      phoneNumberId: log.phoneNumberId,
      status: log.status,
      errorMessage: log.errorMessage,
      account: log.whatsappAccount,
      payload: log.payload,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString()
    }));
  }

  async updateAccount(tenantId: string, accountId: string, input: UpdateWhatsAppAccountInput) {
    const existing = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        deletedAt: null
      }
    });

    if (!existing) {
      throw notFound("WhatsApp account not found");
    }

    const account = await prisma.whatsAppAccount.update({
      where: { id: existing.id },
      data: {
        ...(input.businessAccountId ? { businessAccountId: input.businessAccountId } : {}),
        ...(input.phoneNumberId ? { phoneNumberId: input.phoneNumberId } : {}),
        ...(input.displayPhoneNumber ? { displayPhoneNumber: input.displayPhoneNumber } : {}),
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.accessToken ? { encryptedAccessToken: encryptSecret(input.accessToken) } : {}),
        ...(input.webhookVerifyToken ? { webhookVerifyToken: input.webhookVerifyToken } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.businessAccountId ? { wabaId: input.businessAccountId } : {})
      }
    });

    return serializeAccount(account);
  }

  async deleteAccount(tenantId: string, accountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        deletedAt: null
      }
    });

    if (!account) {
      throw notFound("WhatsApp account not found");
    }

    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: {
        status: "DISABLED",
        deletedAt: new Date()
      }
    });

    return { deleted: true };
  }

  async verifyWebhook(query: Record<string, unknown>) {
    const mode = String(query["hub.mode"] ?? "");
    const token = String(query["hub.verify_token"] ?? "");
    const challenge = String(query["hub.challenge"] ?? "");

    if (mode !== "subscribe" || !challenge) {
      throw forbidden("Invalid WhatsApp webhook verification request");
    }

    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        OR: [
          { webhookVerifyToken: token },
          ...(env.META_WEBHOOK_VERIFY_TOKEN && token === env.META_WEBHOOK_VERIFY_TOKEN
            ? [{ webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN }]
            : [])
        ],
        deletedAt: null
      }
    });

    if (!account && token !== env.META_WEBHOOK_VERIFY_TOKEN) {
      throw forbidden("WhatsApp webhook verify token is invalid");
    }

    if (account) {
      await prisma.whatsAppAccount.update({
        where: { id: account.id },
        data: { status: "CONNECTED", connectedAt: new Date() }
      });
    }

    return challenge;
  }

  async handleWebhook(payload: WhatsAppWebhookPayload) {
    const processed = {
      messages: 0,
      statuses: 0,
      accounts: new Set<string>()
    };

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;

        if (!value || !phoneNumberId) {
          continue;
        }

        const webhookLog = await prisma.whatsAppWebhookLog.create({
          data: {
            phoneNumberId,
            payload: {
              entry,
              change
            } as Prisma.InputJsonValue
          }
        });

        const account = await prisma.whatsAppAccount.findFirst({
          where: {
            phoneNumberId,
            deletedAt: null
          }
        });

        if (!account) {
          await prisma.whatsAppWebhookLog.update({
            where: { id: webhookLog.id },
            data: {
              status: "IGNORED",
              errorMessage: "No active WhatsApp account matched phone_number_id"
            }
          });
          continue;
        }

        await prisma.whatsAppWebhookLog.update({
          where: { id: webhookLog.id },
          data: {
            tenantId: account.tenantId,
            whatsappAccountId: account.id
          }
        });

        processed.accounts.add(account.id);

        try {
          await prisma.whatsAppAccount.update({
            where: { id: account.id },
            data: { lastWebhookAt: new Date() }
          });

          for (const message of value.messages ?? []) {
            const from = String(message.from ?? "");
            const contact = value.contacts?.find((item) => item.wa_id === from);
            const type = webhookMessageType(message);

            const text = webhookMessageText(message);
            const mediaUrl = mediaUrlFromWebhook(message);

            const processedIncoming = await messageProcessingService.processIncoming({
              tenantId: account.tenantId,
              whatsappAccountId: account.id,
              source: "whatsapp",
              phone: from,
              whatsappWaId: from,
              ...(contact?.profile?.name ? { name: contact.profile.name } : {}),
              type,
              ...(text ? { text } : {}),
              ...(mediaUrl ? { mediaUrl } : {}),
              externalId: String(message.id ?? ""),
              rawPayload: {
                entry,
                change,
                message
              }
            });
            await aiAssistantEngineService.handleIncomingMessage({
              tenantId: account.tenantId,
              conversationId: processedIncoming.conversation.id,
              source: "whatsapp"
            });
            processed.messages += 1;
          }

          for (const status of value.statuses ?? []) {
            const providerMessageId = String(status.id ?? "");

            if (!providerMessageId) {
              continue;
            }

            const updated = await prisma.message.updateMany({
              where: {
                tenantId: account.tenantId,
                externalId: providerMessageId
              },
              data: {
                status: statusToMessageStatus(String(status.status ?? "")),
                metadata: {
                  source: "whatsapp",
                  provider: "meta-whatsapp-cloud-api",
                  providerMessageId,
                  rawStatusPayload: status,
                  rawWebhookPayload: payload
                } as Prisma.InputJsonValue
              }
            });

            processed.statuses += updated.count;
          }

          await prisma.whatsAppWebhookLog.update({
            where: { id: webhookLog.id },
            data: { status: "PROCESSED" }
          });
        } catch (error) {
          await prisma.whatsAppWebhookLog.update({
            where: { id: webhookLog.id },
            data: {
              status: "FAILED",
              errorMessage: error instanceof Error ? error.message : "WhatsApp webhook processing failed"
            }
          });
          throw error;
        }
      }
    }

    return {
      messages: processed.messages,
      statuses: processed.statuses,
      accounts: Array.from(processed.accounts)
    };
  }

  async sendText(tenantId: string, input: SendWhatsAppTextInput) {
    return this.sendAndStore(tenantId, input, {
      type: "text",
      text: {
        preview_url: false,
        body: input.text
      }
    });
  }

  async sendMedia(tenantId: string, input: SendWhatsAppMediaInput) {
    return this.sendAndStore(tenantId, input, {
      type: input.type,
      [input.type]: {
        link: input.mediaUrl,
        ...(input.caption ? { caption: input.caption } : {}),
        ...(input.filename ? { filename: input.filename } : {})
      }
    });
  }

  async sendTemplate(tenantId: string, input: SendWhatsAppTemplateInput) {
    return this.sendAndStore(tenantId, input, {
      type: "template",
      template: {
        name: input.templateName,
        language: {
          code: input.languageCode
        },
        components: input.components
      }
    });
  }

  async sendButtons(tenantId: string, input: SendWhatsAppButtonsInput) {
    return this.sendAndStore(tenantId, input, {
      type: "interactive",
      interactive: {
        type: "button",
        ...(input.headerText ? { header: { type: "text", text: input.headerText } } : {}),
        body: { text: input.bodyText },
        ...(input.footerText ? { footer: { text: input.footerText } } : {}),
        action: {
          buttons: input.buttons.map((button: { id: string; title: string }) => ({
            type: "reply",
            reply: {
              id: button.id,
              title: button.title
            }
          }))
        }
      }
    });
  }

  async sendList(tenantId: string, input: SendWhatsAppListInput) {
    return this.sendAndStore(tenantId, input, {
      type: "interactive",
      interactive: {
        type: "list",
        ...(input.headerText ? { header: { type: "text", text: input.headerText } } : {}),
        body: { text: input.bodyText },
        ...(input.footerText ? { footer: { text: input.footerText } } : {}),
        action: {
          button: input.buttonText,
          sections: input.sections
        }
      }
    });
  }

  private async sendAndStore(
    tenantId: string,
    input: { accountId: string; to: string },
    messagePayload: Record<string, unknown>
  ) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: input.accountId,
        tenantId,
        deletedAt: null
      }
    });

    if (!account?.encryptedAccessToken) {
      throw notFound("WhatsApp account or access token not found");
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(input.to),
      ...messagePayload
    };

    const reservation = await usageService.reserveWhatsappMessage(tenantId);
    let response: Awaited<ReturnType<WhatsAppCloudClient["sendMessage"]>>;

    try {
      response = await cloudClient.sendMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken: decryptSecret(account.encryptedAccessToken),
        payload
      });
    } catch (error) {
      await usageService.releaseWhatsappReservation(tenantId, reservation);
      throw error;
    }

    const providerMessageId = response?.messages?.[0]?.id;
    await usageService.recordWhatsappMessage(tenantId, {
      source: "manual_send",
      accountId: account.id,
      to: normalizePhone(input.to),
      providerMessageId: providerMessageId ?? null,
      type: String(messagePayload.type ?? "text")
    });

    const customer = await prisma.customer.upsert({
      where: {
        tenantId_phone: {
          tenantId,
          phone: normalizePhone(input.to)
        }
      },
      update: {
        whatsappWaId: response?.contacts?.[0]?.wa_id ?? normalizePhone(input.to)
      },
      create: {
        tenantId,
        phone: normalizePhone(input.to),
        whatsappWaId: response?.contacts?.[0]?.wa_id ?? normalizePhone(input.to),
        customFields: {
          source: "whatsapp"
        }
      }
    });

    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        customerId: customer.id,
        status: { in: ["OPEN", "PENDING"] },
        deletedAt: null
      },
      orderBy: {
        lastMessageAt: "desc"
      }
    });

    conversation ??= await prisma.conversation.create({
      data: {
        tenantId,
        customerId: customer.id,
        whatsappAccountId: account.id,
        status: "OPEN",
        subject: `WhatsApp chat with ${customer.name ?? customer.phone}`
      }
    });

    const type =
      messagePayload.type === "image" || messagePayload.type === "document"
        ? messagePayload.type
        : "text";
    const text =
      messagePayload.type === "text"
        ? ((messagePayload.text as { body?: string } | undefined)?.body ?? "WhatsApp text message")
        : messagePayload.type === "template"
          ? "WhatsApp template message"
          : messagePayload.type === "interactive"
            ? "WhatsApp interactive message"
            : "WhatsApp media message";

    const stored = await messageProcessingService.processOutgoing({
      tenantId,
      conversationId: conversation.id,
      whatsappAccountId: account.id,
      source: "whatsapp",
      type,
      text,
      status: "sent",
      ...(providerMessageId ? { externalId: providerMessageId } : {}),
      rawPayload: {
        request: payload,
        response
      }
    });

    return {
      providerMessageId,
      conversationId: stored.conversation.id,
      message: {
        id: stored.message.id,
        status: stored.message.status,
        externalId: stored.message.externalId
      }
    };
  }
}

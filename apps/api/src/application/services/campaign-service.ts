import { Prisma, prisma } from "@novachat/database";
import type {
  CampaignAudience,
  CampaignInput,
  CampaignScheduleInput,
  CampaignTemplateInput,
  CampaignsQuery,
  CampaignUpdateInput,
  TemplatesQuery
} from "@novachat/shared-types";
import { badRequest, notFound } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { campaignQueue } from "../../infrastructure/queue/queue.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { WhatsAppService } from "./whatsapp-service.js";
import { BillingService } from "./billing-service.js";

const whatsAppService = new WhatsAppService();
const billingService = new BillingService();

type CustomFields = Record<string, unknown>;
type RecipientCandidate = { phone: string; customerId?: string; optedOut: boolean };

function normalizePhone(phone: string) {
  return phone.trim().replace(/[^\d+]/g, "");
}

function customFields(value: Prisma.JsonValue | null): CustomFields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as CustomFields) : {};
}

function hasOptedIn(customer: { customFields: Prisma.JsonValue | null }) {
  const fields = customFields(customer.customFields);
  return fields.whatsappOptIn === true || fields.marketingOptIn === true || fields.optIn === true;
}

function hasOptedOut(customer: { customFields: Prisma.JsonValue | null }) {
  const fields = customFields(customer.customFields);
  return fields.whatsappOptOut === true || fields.marketingOptOut === true || fields.unsubscribed === true;
}

function parseCsvRecipients(csv: string | undefined): Array<{ phone: string; name?: string }> {
  if (!csv?.trim()) return [];

  const recipients: Array<{ phone: string; name?: string }> = [];
  for (const [index, rawLine] of csv.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const [phone = "", name = ""] = line.split(",").map((item) => item.trim());
    if (!phone || (index === 0 && phone.toLowerCase().includes("phone"))) continue;

    recipients.push({
      phone: normalizePhone(phone),
      ...(name ? { name } : {})
    });
  }

  return recipients;
}

function serializeTemplate(template: TemplateRecord) {
  return {
    id: template.id,
    name: template.name,
    languageCode: template.languageCode,
    category: template.category,
    status: template.status,
    bodyText: template.bodyText,
    components: template.components ?? [],
    metadata: template.metadata ?? {},
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString()
  };
}

function serializeCampaign(campaign: CampaignRecord) {
  const counts = campaign.recipients.reduce<Record<string, number>>((acc, recipient) => {
    acc[recipient.status] = (acc[recipient.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    id: campaign.id,
    whatsappAccountId: campaign.whatsappAccountId,
    name: campaign.name,
    status: campaign.status,
    audience: campaign.audience,
    templateName: campaign.templateName,
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    recipientStats: {
      total: campaign.recipients.length,
      pending: counts.PENDING ?? 0,
      sent: counts.SENT ?? 0,
      delivered: counts.DELIVERED ?? 0,
      read: counts.READ ?? 0,
      replied: counts.REPLIED ?? 0,
      failed: counts.FAILED ?? 0,
      optedOut: counts.OPTED_OUT ?? 0
    },
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString()
  };
}

type TemplateRecord = Prisma.WhatsAppTemplateGetPayload<Record<string, never>>;
type CampaignRecord = Prisma.CampaignGetPayload<{
  include: {
    recipients: {
      where: { deletedAt: null };
      orderBy: { createdAt: "asc" };
    };
  };
}>;

export class CampaignService {
  async templates(tenantId: string, query: TemplatesQuery) {
    const pagination = createPagination(query);
    const where: Prisma.WhatsAppTemplateWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {})
    };

    const [total, items] = await prisma.$transaction([
      prisma.whatsAppTemplate.count({ where }),
      prisma.whatsAppTemplate.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return { items: items.map(serializeTemplate), pagination: pagination.meta(total) };
  }

  async createTemplate(tenantId: string, input: CampaignTemplateInput) {
    const template = await prisma.whatsAppTemplate.upsert({
      where: {
        tenantId_name_languageCode: {
          tenantId,
          name: input.name,
          languageCode: input.languageCode
        }
      },
      update: {
        category: input.category,
        status: input.status,
        bodyText: input.bodyText,
        components: input.components as Prisma.InputJsonValue,
        metadata: input.metadata as Prisma.InputJsonValue,
        deletedAt: null
      },
      create: {
        tenantId,
        name: input.name,
        languageCode: input.languageCode,
        category: input.category,
        status: input.status,
        bodyText: input.bodyText,
        components: input.components as Prisma.InputJsonValue,
        metadata: input.metadata as Prisma.InputJsonValue
      }
    });

    return serializeTemplate(template);
  }

  async campaigns(tenantId: string, query: CampaignsQuery) {
    const pagination = createPagination(query);
    const where: Prisma.CampaignWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {})
    };

    const [total, items] = await prisma.$transaction([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        include: { recipients: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return { items: items.map(serializeCampaign), pagination: pagination.meta(total) };
  }

  async campaign(tenantId: string, id: string) {
    return serializeCampaign(await this.findCampaign(tenantId, id));
  }

  async createCampaign(tenantId: string, input: CampaignInput) {
    const template = await this.resolveApprovedTemplate(tenantId, input.templateId, input.templateName, input.languageCode);
    const accountId = await this.resolveAccountId(tenantId, input.whatsappAccountId);
    const audience = {
      ...input.audience,
      templateId: template.id,
      languageCode: template.languageCode,
      complianceWarnings: this.complianceWarnings(input.audience)
    };
    const recipients = await this.resolveRecipients(tenantId, input.audience);

    if (!recipients.length) {
      throw badRequest("No opted-in recipients matched this campaign audience.");
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          tenantId,
          whatsappAccountId: accountId,
          name: input.name,
          status: input.status,
          audience: audience as Prisma.InputJsonValue,
          templateName: template.name,
          scheduledAt: input.scheduledAt ?? null
        }
      });

      await tx.campaignRecipient.createMany({
        data: recipients.map((recipient) => ({
          tenantId,
          campaignId: created.id,
          customerId: recipient.customerId ?? null,
          phone: recipient.phone,
          status: recipient.optedOut ? "OPTED_OUT" : "PENDING"
        })),
        skipDuplicates: true
      });

      return tx.campaign.findFirstOrThrow({
        where: { id: created.id, tenantId },
        include: { recipients: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } }
      });
    });

    return serializeCampaign(campaign);
  }

  async updateCampaign(tenantId: string, id: string, input: CampaignUpdateInput) {
    await this.assertEditable(tenantId, id);
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.whatsappAccountId !== undefined ? { whatsappAccountId: input.whatsappAccountId } : {}),
        ...(input.templateName !== undefined ? { templateName: input.templateName } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
        ...(input.audience !== undefined ? { audience: input.audience as Prisma.InputJsonValue } : {})
      },
      include: { recipients: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } }
    });

    return serializeCampaign(campaign);
  }

  async deleteCampaign(tenantId: string, id: string) {
    await this.assertEditable(tenantId, id);
    await prisma.campaign.update({
      where: { id },
      data: {
        status: "CANCELLED",
        deletedAt: new Date(),
        recipients: {
          updateMany: {
            where: { deletedAt: null },
            data: { deletedAt: new Date() }
          }
        }
      }
    });

    return { deleted: true };
  }

  async schedule(tenantId: string, id: string, input: CampaignScheduleInput) {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        scheduledAt: input.scheduledAt
      },
      include: { recipients: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } }
    });

    if (campaign.tenantId !== tenantId || campaign.deletedAt) {
      throw notFound("Campaign not found");
    }

    await this.enqueueCampaign(campaign.id, campaign.tenantId, input.scheduledAt);
    return serializeCampaign(campaign);
  }

  async sendNow(tenantId: string, id: string) {
    const campaign = await this.findCampaign(tenantId, id);
    await this.enqueueCampaign(campaign.id, tenantId);
    return {
      queued: true,
      campaign: serializeCampaign(campaign)
    };
  }

  async stop(tenantId: string, id: string) {
    const campaign = await this.findCampaign(tenantId, id);
    if (!["SCHEDULED", "RUNNING", "PAUSED"].includes(campaign.status)) {
      throw badRequest("Only scheduled or running campaigns can be stopped.");
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { recipients: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } }
    });

    return serializeCampaign(updated);
  }

  async analytics(tenantId: string, id: string) {
    const campaign = await this.findCampaign(tenantId, id);
    const recipients = campaign.recipients;
    const total = recipients.length || 1;

    return {
      campaign: serializeCampaign(campaign),
      rates: {
        sent: recipients.filter((item) => ["SENT", "DELIVERED", "READ", "REPLIED"].includes(item.status)).length / total,
        delivered: recipients.filter((item) => ["DELIVERED", "READ", "REPLIED"].includes(item.status)).length / total,
        read: recipients.filter((item) => ["READ", "REPLIED"].includes(item.status)).length / total,
        replied: recipients.filter((item) => item.status === "REPLIED").length / total,
        failed: recipients.filter((item) => item.status === "FAILED").length / total,
        optedOut: recipients.filter((item) => item.status === "OPTED_OUT").length / total
      },
      failures: recipients.filter((item) => item.status === "FAILED").slice(0, 25).map((item) => ({
        id: item.id,
        phone: item.phone,
        error: item.error
      }))
    };
  }

  async processCampaign(campaignId: string, tenantId: string) {
    const campaign = await this.findCampaign(tenantId, campaignId);
    if (campaign.status === "CANCELLED" || campaign.status === "COMPLETED") {
      return { skipped: true, reason: "campaign_not_runnable" };
    }

    if (!campaign.whatsappAccountId || !campaign.templateName) {
      throw badRequest("Campaign requires a WhatsApp account and approved template.");
    }

    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "RUNNING" } });

    const audience = customFields(campaign.audience);
    const languageCode = typeof audience.languageCode === "string" ? audience.languageCode : "en_US";
    const components = Array.isArray(audience.components) ? audience.components : [];
    const pending = campaign.recipients.filter((recipient) => recipient.status === "PENDING");
    await billingService.assertPlanAllowance(tenantId, "monthlyCampaignSends", pending.length);
    let sent = 0;
    let failed = 0;

    for (const recipient of pending) {
      const current = await prisma.campaign.findFirst({
        where: { id: campaign.id, tenantId },
        select: { status: true }
      });
      if (!current || current.status === "CANCELLED" || current.status === "PAUSED") {
        break;
      }

      try {
        await whatsAppService.sendTemplate(tenantId, {
          accountId: campaign.whatsappAccountId,
          to: recipient.phone,
          templateName: campaign.templateName,
          languageCode,
          components
        });
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "SENT", sentAt: new Date(), error: null }
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Campaign send failed";
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "FAILED", error: message }
        });
        failed += 1;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const remaining = await prisma.campaignRecipient.count({
      where: { tenantId, campaignId: campaign.id, status: "PENDING", deletedAt: null }
    });

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: remaining ? "PAUSED" : failed && !sent ? "FAILED" : "COMPLETED" }
    });

    logger.info({ campaignId, tenantId, sent, failed, remaining }, "Campaign processing finished");
    return { sent, failed, remaining };
  }

  private async resolveApprovedTemplate(tenantId: string, templateId?: string, templateName?: string, languageCode = "en_US") {
    if (!templateId && !templateName) {
      throw badRequest("Campaign requires an approved WhatsApp template.");
    }

    const template = await prisma.whatsAppTemplate.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: "APPROVED",
        ...(templateId ? { id: templateId } : { name: templateName as string, languageCode })
      }
    });

    if (!template) {
      throw badRequest("Campaign requires an approved WhatsApp template.");
    }

    return template;
  }

  private async resolveAccountId(tenantId: string, accountId?: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: "CONNECTED",
        ...(accountId ? { id: accountId } : {})
      },
      orderBy: { updatedAt: "desc" }
    });

    if (!account) {
      throw badRequest("A connected WhatsApp Cloud API account is required.");
    }

    return account.id;
  }

  private async resolveRecipients(tenantId: string, audience: CampaignAudience) {
    const manual: RecipientCandidate[] = [...audience.manualRecipients, ...parseCsvRecipients(audience.csv)].map((recipient) => ({
      phone: normalizePhone(recipient.phone),
      ...("customerId" in recipient && recipient.customerId ? { customerId: recipient.customerId } : {}),
      optedOut: false
    }));

    if (audience.source === "CSV" || audience.source === "MANUAL") {
      return this.uniqueRecipients(manual);
    }

    const customers = await prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(audience.source === "ALL_CUSTOMERS" ? {} : {}),
        ...(audience.customerStatus ? { status: audience.customerStatus } : { status: "ACTIVE" }),
        ...(audience.search
          ? {
              OR: [
                { name: { contains: audience.search, mode: "insensitive" } },
                { phone: { contains: audience.search } },
                { email: { contains: audience.search, mode: "insensitive" } }
              ]
            }
          : {}),
        ...(audience.createdFrom || audience.createdTo
          ? { createdAt: { ...(audience.createdFrom ? { gte: audience.createdFrom } : {}), ...(audience.createdTo ? { lte: audience.createdTo } : {}) } }
          : {})
      },
      select: { id: true, phone: true, customFields: true }
    });

    return this.uniqueRecipients(
      customers
        .filter((customer) => (!audience.optInOnly || hasOptedIn(customer)) && (!audience.excludeOptedOut || !hasOptedOut(customer)))
        .map((customer) => ({
          phone: normalizePhone(customer.phone),
          customerId: customer.id,
          optedOut: hasOptedOut(customer)
        }))
    );
  }

  private uniqueRecipients(recipients: RecipientCandidate[]) {
    const byPhone = new Map<string, RecipientCandidate>();
    for (const recipient of recipients) {
      if (recipient.phone) byPhone.set(recipient.phone, recipient);
    }
    return Array.from(byPhone.values());
  }

  private complianceWarnings(audience: CampaignAudience) {
    return [
      "Only Official WhatsApp Business Platform template messages are supported.",
      "Campaigns require customer opt-in and opt-out handling.",
      audience.optInOnly ? "Opt-in filter enabled." : "Opt-in filter is disabled; review compliance before sending.",
      audience.excludeOptedOut ? "Opted-out contacts are excluded." : "Opted-out contacts are not excluded; review compliance before sending.",
      "Use approved templates for messages outside the 24-hour customer service window."
    ];
  }

  private async enqueueCampaign(campaignId: string, tenantId: string, scheduledAt?: Date | null) {
    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
    const job = await campaignQueue.add(
      "send-campaign",
      { campaignId, tenantId },
      {
        jobId: `campaign-${campaignId}-${scheduledAt?.getTime() ?? "now"}`,
        delay,
        removeOnComplete: true,
        removeOnFail: 500
      }
    );
    logger.info({ jobId: job.id, campaignId, tenantId, delay }, "Campaign queued");
  }

  private async findCampaign(tenantId: string, id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { recipients: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } }
    });

    if (!campaign) throw notFound("Campaign not found");
    return campaign;
  }

  private async assertEditable(tenantId: string, id: string) {
    const campaign = await this.findCampaign(tenantId, id);
    if (["RUNNING", "COMPLETED"].includes(campaign.status)) {
      throw badRequest("Running or completed campaigns cannot be edited.");
    }
  }
}

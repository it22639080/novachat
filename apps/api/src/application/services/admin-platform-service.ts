import { Prisma, prisma } from "@novachat/database";
import type {
  AdminAnnouncementInput,
  AdminFeatureFlagsInput,
  AdminListQuery,
  AdminTenantStatusUpdateInput
} from "@novachat/shared-types";
import { notFound } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function isTenantStatus(status: string | undefined): status is "ACTIVE" | "SUSPENDED" | "ARCHIVED" {
  return status === "ACTIVE" || status === "SUSPENDED" || status === "ARCHIVED";
}

function isSubscriptionStatus(status: string | undefined): status is "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" {
  return status === "TRIALING" || status === "ACTIVE" || status === "PAST_DUE" || status === "CANCELED" || status === "EXPIRED";
}

function serializeTenant(tenant: TenantListRecord) {
  const subscription = tenant.subscriptions[0] ?? null;
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    timezone: tenant.timezone,
    members: tenant._count.members,
    customers: tenant._count.customers,
    conversations: tenant._count.conversations,
    campaigns: tenant._count.campaigns,
    plan: subscription?.plan.name ?? tenant.usageLimit?.planName ?? "Starter",
    billingStatus: tenant.usageLimit?.billingStatus ?? subscription?.status ?? "TRIALING",
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString()
  };
}

type TenantListRecord = Prisma.TenantGetPayload<{
  include: {
    usageLimit: true;
    subscriptions: {
      where: { deletedAt: null };
      orderBy: { createdAt: "desc" };
      take: 1;
      include: { plan: true };
    };
    _count: {
      select: {
        members: true;
        customers: true;
        conversations: true;
        campaigns: true;
      };
    };
  };
}>;

export class AdminPlatformService {
  async overview() {
    const monthStart = startOfMonth();
    const [
      tenants,
      activeTenants,
      users,
      conversations,
      aiUsage,
      whatsappUsage,
      storageDocuments,
      campaigns,
      invoices,
      payments
    ] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.conversation.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.tenantUsageCounter.aggregate({ _sum: { aiRepliesUsedThisMonth: true, aiCostUsedThisMonth: true } }),
      prisma.tenantUsageCounter.aggregate({ _sum: { whatsappMessagesUsedThisMonth: true } }),
      prisma.knowledgeBaseDocument.aggregate({ where: { deletedAt: null }, _sum: { fileSize: true } }),
      prisma.campaignRecipient.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.invoice.aggregate({ where: { deletedAt: null }, _sum: { total: true }, _count: { id: true } }),
      prisma.payment.aggregate({ where: { deletedAt: null, status: "SUCCEEDED" }, _sum: { amount: true }, _count: { id: true } })
    ]);

    return {
      totals: {
        tenants,
        activeTenants,
        users,
        monthlyConversations: conversations,
        monthlyAiReplies: aiUsage._sum.aiRepliesUsedThisMonth ?? 0,
        monthlyWhatsappMessages: whatsappUsage._sum.whatsappMessagesUsedThisMonth ?? 0,
        monthlyCampaignRecipients: campaigns,
        storageMb: Math.ceil((storageDocuments._sum.fileSize ?? 0) / (1024 * 1024)),
        invoiceTotal: decimalToNumber(invoices._sum.total),
        paidTotal: decimalToNumber(payments._sum.amount),
        invoices: invoices._count.id,
        payments: payments._count.id
      },
      placeholders: {
        supportTickets: 0,
        featureFlags: 5,
        announcements: 0
      }
    };
  }

  async tenants(query: AdminListQuery) {
    const pagination = createPagination(query);
    const where: Prisma.TenantWhereInput = {
      deletedAt: null
    };
    if (isTenantStatus(query.status)) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } }
      ];
    }

    const [total, items] = await prisma.$transaction([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        include: {
          usageLimit: true,
          subscriptions: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { plan: true }
          },
          _count: {
            select: { members: true, customers: true, conversations: true, campaigns: true }
          }
        },
        orderBy: { [query.sortBy === "name" || query.sortBy === "status" ? query.sortBy : "createdAt"]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return { items: items.map(serializeTenant), pagination: pagination.meta(total) };
  }

  async tenantDetail(tenantId: string) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      include: {
        usageLimit: true,
        usageCounter: true,
        creditBalance: true,
        subscriptions: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { plan: true } },
        members: { where: { deletedAt: null }, include: { user: { select: { id: true, email: true, name: true } } }, take: 20 },
        invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 },
        payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 },
        whatsappAccounts: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          include: {
            metaConnectionLogs: { orderBy: { createdAt: "desc" }, take: 5 },
            webhookLogs: { orderBy: { createdAt: "desc" }, take: 5 }
          }
        },
        _count: {
          select: {
            customers: true,
            conversations: true,
            messages: true,
            campaigns: true,
            chatbots: true,
            knowledgeBaseDocuments: true
          }
        }
      }
    });

    if (!tenant) throw notFound("Tenant not found");

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      timezone: tenant.timezone,
      usageLimit: tenant.usageLimit,
      usageCounter: tenant.usageCounter
        ? {
            ...tenant.usageCounter,
            aiCostUsedToday: decimalToNumber(tenant.usageCounter.aiCostUsedToday),
            aiCostUsedThisMonth: decimalToNumber(tenant.usageCounter.aiCostUsedThisMonth)
          }
        : null,
      creditBalance: tenant.creditBalance,
      subscriptions: tenant.subscriptions.map((subscription) => ({
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan.name,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      })),
      members: tenant.members.map((member) => ({
        id: member.id,
        role: member.role,
        status: member.status,
        user: member.user
      })),
      invoices: tenant.invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        total: decimalToNumber(invoice.total),
        currency: invoice.currency
      })),
      payments: tenant.payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        amount: decimalToNumber(payment.amount),
        provider: payment.provider,
        currency: payment.currency
      })),
      whatsappAccounts: tenant.whatsappAccounts.map((account) => ({
        id: account.id,
        onboardingMethod: account.onboardingMethod,
        status: account.status,
        displayPhoneNumber: account.displayPhoneNumber,
        displayName: account.displayName,
        verifiedName: account.verifiedName,
        phoneNumberId: account.phoneNumberId,
        wabaId: account.wabaId,
        qualityRating: account.qualityRating,
        connectedAt: account.connectedAt?.toISOString() ?? null,
        disconnectedAt: account.disconnectedAt?.toISOString() ?? null,
        lastHealthCheckAt: account.lastHealthCheckAt?.toISOString() ?? null,
        lastWebhookAt: account.lastWebhookAt?.toISOString() ?? null,
        setupErrors: account.setupErrors,
        metaConnectionLogs: account.metaConnectionLogs.map((log) => ({
          id: log.id,
          eventType: log.eventType,
          status: log.status,
          message: log.message,
          metadata: log.metadata,
          createdAt: log.createdAt.toISOString()
        })),
        webhookLogs: account.webhookLogs.map((log) => ({
          id: log.id,
          phoneNumberId: log.phoneNumberId,
          status: log.status,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt.toISOString()
        }))
      })),
      counts: tenant._count,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    };
  }

  async updateTenantStatus(tenantId: string, input: AdminTenantStatusUpdateInput, actorUserId?: string | null) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: input.status },
      select: { id: true, name: true, slug: true, status: true }
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: actorUserId ?? null,
        action: "platform.tenant_status_update",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: { status: input.status, reason: input.reason ?? null }
      }
    });

    return tenant;
  }

  async users(query: AdminListQuery) {
    const pagination = createPagination(query);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [total, items] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: { members: { where: { deletedAt: null }, include: { tenant: { select: { id: true, name: true, slug: true } } } } },
        orderBy: { createdAt: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        tenants: user.members.map((membership) => ({
          tenant: membership.tenant,
          role: membership.role,
          status: membership.status
        })),
        createdAt: user.createdAt.toISOString()
      })),
      pagination: pagination.meta(total)
    };
  }

  async plans() {
    const plans = await prisma.plan.findMany({ where: { deletedAt: null }, orderBy: { priceMonthly: "asc" } });
    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      priceMonthly: decimalToNumber(plan.priceMonthly),
      currency: plan.currency,
      limits: plan.limits,
      isActive: plan.isActive
    }));
  }

  async subscriptions(query: AdminListQuery) {
    const pagination = createPagination(query);
    const where: Prisma.SubscriptionWhereInput = {
      deletedAt: null
    };
    if (isSubscriptionStatus(query.status)) {
      where.status = query.status;
    }
    const [total, items] = await prisma.$transaction([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        include: { tenant: { select: { id: true, name: true, slug: true } }, plan: true },
        orderBy: { createdAt: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return {
      items: items.map((subscription) => ({
        id: subscription.id,
        tenant: subscription.tenant,
        plan: subscription.plan.name,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      })),
      pagination: pagination.meta(total)
    };
  }

  async billing(query: AdminListQuery) {
    const pagination = createPagination(query);
    const [invoiceTotal, invoices, paymentTotal, payments] = await prisma.$transaction([
      prisma.invoice.count({ where: { deletedAt: null } }),
      prisma.invoice.findMany({
        where: { deletedAt: null },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.payment.count({ where: { deletedAt: null } }),
      prisma.payment.findMany({
        where: { deletedAt: null },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        take: 20
      })
    ]);

    return {
      invoices: {
        items: invoices.map((invoice) => ({
          id: invoice.id,
          tenant: invoice.tenant,
          number: invoice.number,
          status: invoice.status,
          total: decimalToNumber(invoice.total),
          currency: invoice.currency,
          createdAt: invoice.createdAt.toISOString()
        })),
        pagination: pagination.meta(invoiceTotal)
      },
      payments: {
        total: paymentTotal,
        items: payments.map((payment) => ({
          id: payment.id,
          tenant: payment.tenant,
          status: payment.status,
          amount: decimalToNumber(payment.amount),
          currency: payment.currency,
          provider: payment.provider,
          createdAt: payment.createdAt.toISOString()
        }))
      }
    };
  }

  async usage() {
    const [counters, documents, campaignRecipients] = await Promise.all([
      prisma.tenantUsageCounter.findMany({
        where: { deletedAt: null },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
        orderBy: { updatedAt: "desc" },
        take: 50
      }),
      prisma.knowledgeBaseDocument.groupBy({
        by: ["tenantId"],
        where: { deletedAt: null },
        _sum: { fileSize: true }
      }),
      prisma.campaignRecipient.groupBy({
        by: ["tenantId"],
        where: { deletedAt: null },
        _count: { id: true }
      })
    ]);

    const storageByTenant = new Map(documents.map((item) => [item.tenantId, Math.ceil((item._sum.fileSize ?? 0) / (1024 * 1024))]));
    const campaignByTenant = new Map(campaignRecipients.map((item) => [item.tenantId, item._count.id]));

    return counters.map((counter) => ({
      tenant: counter.tenant,
      aiRepliesUsedThisMonth: counter.aiRepliesUsedThisMonth,
      whatsappMessagesUsedThisMonth: counter.whatsappMessagesUsedThisMonth,
      aiInputTokensUsed: counter.aiInputTokensUsed,
      aiOutputTokensUsed: counter.aiOutputTokensUsed,
      aiCostUsedThisMonth: decimalToNumber(counter.aiCostUsedThisMonth),
      storageMb: storageByTenant.get(counter.tenantId) ?? 0,
      campaignRecipients: campaignByTenant.get(counter.tenantId) ?? 0,
      aiDisabledDueToLimit: counter.aiDisabledDueToLimit,
      whatsappDisabledDueToLimit: counter.whatsappDisabledDueToLimit
    }));
  }

  async auditLogs(query: AdminListQuery) {
    const pagination = createPagination(query);
    const [total, items] = await prisma.$transaction([
      prisma.auditLog.count({ where: {} }),
      prisma.auditLog.findMany({
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          actor: { select: { id: true, email: true, name: true } }
        },
        orderBy: { createdAt: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return {
      items: items.map((log) => ({
        id: log.id,
        tenant: log.tenant,
        actor: log.actor,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString()
      })),
      pagination: pagination.meta(total)
    };
  }

  async systemHealth() {
    const [tenants, users, messages, failedAiLogs, failedCampaigns] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.aiLog.count({ where: { status: "FAILED" } }),
      prisma.campaignRecipient.count({ where: { status: "FAILED", deletedAt: null } })
    ]);

    return {
      status: "operational",
      database: "connected",
      redis: "configured",
      queues: ["knowledge", "usage", "campaign"],
      checks: { tenants, users, messages, failedAiLogs, failedCampaigns },
      checkedAt: new Date().toISOString()
    };
  }

  async settings() {
    return {
      featureFlags: {
        aiAssistant: true,
        campaigns: true,
        billing: true,
        integrations: false,
        publicBooking: false
      },
      supportTickets: [],
      announcements: []
    };
  }

  async updateFeatureFlags(input: AdminFeatureFlagsInput) {
    return {
      featureFlags: input,
      message: "Feature flag persistence placeholder. Add a platform settings table before enabling runtime flagging."
    };
  }

  async createAnnouncement(input: AdminAnnouncementInput) {
    return {
      id: `announcement_${Date.now()}`,
      ...input,
      status: "DRAFT",
      message: "Announcement placeholder created. Persistence and delivery can be added in a later phase."
    };
  }
}

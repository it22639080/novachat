import { Prisma, prisma } from "@novachat/database";
import type {
  AdminAnnouncementInput,
  AdminChangePlanInput,
  AdminFeatureFlagsInput,
  AdminListQuery,
  AdminPaymentReviewInput,
  AdminPlanInput,
  AdminPlanUpdateInput,
  AdminRejectAccountInput,
  AdminSuspendAccountInput,
  AdminTenantStatusUpdateInput,
  AdminUsageCreditsInput
} from "@novachat/shared-types";
import { badRequest, notFound } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { slugify } from "../../shared/strings/slugify.js";

const activeTenantStatuses = ["ACTIVE", "APPROVED"] as const;
const activeSubscriptionStatuses = ["TRIAL", "TRIALING", "ACTIVE"] as const;
const tenantStatuses = [
  "PENDING_EMAIL_VERIFICATION",
  "PENDING_ADMIN_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "ARCHIVED"
] as const;
const subscriptionStatuses = ["TRIAL", "TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "CANCELED", "EXPIRED"] as const;
const paymentStatuses = ["PENDING", "PAID", "SUCCEEDED", "FAILED", "OVERDUE", "REFUNDED", "CANCELLED", "CANCELED"] as const;

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

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function isTenantStatus(status: string | undefined): status is (typeof tenantStatuses)[number] {
  return tenantStatuses.includes(status as (typeof tenantStatuses)[number]);
}

function isSubscriptionStatus(status: string | undefined): status is (typeof subscriptionStatuses)[number] {
  return subscriptionStatuses.includes(status as (typeof subscriptionStatuses)[number]);
}

function isPaymentStatus(status: string | undefined): status is (typeof paymentStatuses)[number] {
  return paymentStatuses.includes(status as (typeof paymentStatuses)[number]);
}

function planLimitsFromInput(input: AdminPlanInput | AdminPlanUpdateInput) {
  const limits: Record<string, unknown> = {};
  if (input.aiReplyLimit !== undefined) limits.aiResponses = input.aiReplyLimit;
  if (input.aiInputTokenLimit !== undefined) limits.aiInputTokens = input.aiInputTokenLimit;
  if (input.aiOutputTokenLimit !== undefined) limits.aiOutputTokens = input.aiOutputTokenLimit;
  if (input.whatsappMessageLimit !== undefined) limits.monthlyMessages = input.whatsappMessageLimit;
  if (input.agentLimit !== undefined) limits.seats = input.agentLimit;
  if (input.whatsappAccountLimit !== undefined) limits.whatsappAccounts = input.whatsappAccountLimit;
  if (input.knowledgeBaseStorageLimitBytes !== undefined) {
    limits.knowledgeBaseStorageLimitBytes = input.knowledgeBaseStorageLimitBytes;
  }
  if (input.featuresJson !== undefined) limits.features = input.featuresJson;
  return limits;
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
    approvedAt: tenant.approvedAt?.toISOString() ?? null,
    rejectedAt: tenant.rejectedAt?.toISOString() ?? null,
    rejectionReason: tenant.rejectionReason,
    suspendedAt: tenant.suspendedAt?.toISOString() ?? null,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString()
  };
}

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
      payments,
      pendingApprovals,
      suspendedTenants,
      overdueInvoices,
      pendingPayments,
      connectedWhatsApp,
      disconnectedWhatsApp,
      expiringSubscriptions,
      tokenUsage
    ] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({ where: { deletedAt: null, status: { in: [...activeTenantStatuses] } } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.conversation.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.tenantUsageCounter.aggregate({ _sum: { aiRepliesUsedThisMonth: true, aiCostUsedThisMonth: true } }),
      prisma.tenantUsageCounter.aggregate({ _sum: { whatsappMessagesUsedThisMonth: true } }),
      prisma.knowledgeBaseDocument.aggregate({ where: { deletedAt: null }, _sum: { fileSize: true } }),
      prisma.campaignRecipient.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.invoice.aggregate({ where: { deletedAt: null }, _sum: { total: true }, _count: { id: true } }),
      prisma.payment.aggregate({
        where: { deletedAt: null, status: { in: ["SUCCEEDED", "PAID"] } },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.tenant.count({ where: { deletedAt: null, status: "PENDING_ADMIN_APPROVAL" } }),
      prisma.tenant.count({ where: { deletedAt: null, status: "SUSPENDED" } }),
      prisma.invoice.count({
        where: { deletedAt: null, status: { in: ["OPEN", "UNCOLLECTIBLE"] }, dueAt: { lt: new Date() } }
      }),
      prisma.payment.count({ where: { deletedAt: null, status: "PENDING" } }),
      prisma.whatsAppAccount.count({ where: { deletedAt: null, status: "CONNECTED" } }),
      prisma.whatsAppAccount.count({ where: { deletedAt: null, status: { not: "CONNECTED" } } }),
      prisma.subscription.count({
        where: {
          deletedAt: null,
          status: { in: [...activeSubscriptionStatuses] },
          currentPeriodEnd: { lte: addDays(new Date(), 14) }
        }
      }),
      prisma.tenantUsageCounter.aggregate({ _sum: { aiInputTokensUsed: true, aiOutputTokensUsed: true } })
    ]);

    return {
      totals: {
        users,
        tenants,
        pendingApprovals,
        activeTenants,
        suspendedTenants,
        monthlyRevenue: decimalToNumber(payments._sum.amount),
        pendingPayments,
        overduePayments: overdueInvoices,
        totalAiReplies: aiUsage._sum.aiRepliesUsedThisMonth ?? 0,
        totalInputTokens: tokenUsage._sum.aiInputTokensUsed ?? 0,
        totalOutputTokens: tokenUsage._sum.aiOutputTokensUsed ?? 0,
        totalWhatsappMessages: whatsappUsage._sum.whatsappMessagesUsedThisMonth ?? 0,
        connectedWhatsAppSessions: connectedWhatsApp,
        disconnectedWhatsAppSessions: disconnectedWhatsApp,
        subscriptionsExpiringSoon: expiringSubscriptions,
        monthlyConversations: conversations,
        monthlyCampaignRecipients: campaigns,
        storageMb: Math.ceil((storageDocuments._sum.fileSize ?? 0) / (1024 * 1024)),
        invoiceTotal: decimalToNumber(invoices._sum.total),
        paidTotal: decimalToNumber(payments._sum.amount),
        invoices: invoices._count.id,
        payments: payments._count.id
      }
    };
  }

  async tenants(query: AdminListQuery) {
    const pagination = createPagination(query);
    const where: Prisma.TenantWhereInput = { deletedAt: null };
    if (isTenantStatus(query.status)) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { slug: { contains: query.search, mode: "insensitive" } }
      ];
    }

    const sortBy = query.sortBy === "name" || query.sortBy === "status" ? query.sortBy : "createdAt";
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
          _count: { select: { members: true, customers: true, conversations: true, campaigns: true } }
        },
        orderBy: { [sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return { items: items.map(serializeTenant), pagination: pagination.meta(total) };
  }

  async pendingApprovals(query: AdminListQuery) {
    return this.tenants({ ...query, status: "PENDING_ADMIN_APPROVAL" });
  }

  async tenantDetail(tenantId: string) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      include: {
        usageLimit: true,
        usageCounter: true,
        creditBalance: true,
        monthlyUsage: { orderBy: { periodStart: "desc" }, take: 12 },
        subscriptions: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { plan: true } },
        members: { where: { deletedAt: null }, include: { user: { select: { id: true, email: true, name: true } } }, take: 50 },
        invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20 },
        payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20 },
        usageRecords: { orderBy: { createdAt: "desc" }, take: 50 },
        whatsappAccounts: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
        auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
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
      approval: {
        approvedAt: tenant.approvedAt?.toISOString() ?? null,
        approvedBy: tenant.approvedBy,
        rejectedAt: tenant.rejectedAt?.toISOString() ?? null,
        rejectionReason: tenant.rejectionReason,
        suspendedAt: tenant.suspendedAt?.toISOString() ?? null,
        suspendedBy: tenant.suspendedBy
      },
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
        billingCycle: subscription.billingCycle,
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
        number: invoice.invoiceNumber ?? invoice.number,
        status: invoice.status,
        total: decimalToNumber(invoice.total),
        currency: invoice.currency,
        dueAt: invoice.dueAt?.toISOString() ?? null
      })),
      payments: tenant.payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        amount: decimalToNumber(payment.amount),
        provider: payment.provider,
        method: payment.method,
        currency: payment.currency,
        createdAt: payment.createdAt.toISOString()
      })),
      usageRecords: tenant.usageRecords.map((record) => ({
        id: record.id,
        type: record.type,
        quantity: record.quantity,
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        estimatedCost: decimalToNumber(record.estimatedCost),
        createdAt: record.createdAt.toISOString()
      })),
      whatsappAccounts: tenant.whatsappAccounts.map((account) => ({
        id: account.id,
        providerType: "META_CLOUD",
        onboardingMethod: account.onboardingMethod,
        status: account.status,
        displayPhoneNumber: account.displayPhoneNumber,
        displayName: account.displayName,
        verifiedName: account.verifiedName,
        phoneNumberId: account.phoneNumberId,
        connectedAt: account.connectedAt?.toISOString() ?? null,
        lastWebhookAt: account.lastWebhookAt?.toISOString() ?? null
      })),
      counts: tenant._count,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    };
  }

  async updateTenantStatus(tenantId: string, input: AdminTenantStatusUpdateInput, actorUserId?: string | null) {
    const now = new Date();
    const data: Prisma.TenantUpdateInput = {
      status: input.status,
      approvalStatusChangedAt: now
    };
    if (input.status === "APPROVED" || input.status === "ACTIVE") {
      data.approvedAt = now;
      data.approvedBy = actorUserId ?? null;
      data.rejectedAt = null;
      data.rejectionReason = null;
      data.suspendedAt = null;
      data.suspendedBy = null;
    }
    if (input.status === "REJECTED") {
      data.rejectedAt = now;
      data.rejectionReason = input.reason ?? "Rejected by platform administrator";
    }
    if (input.status === "SUSPENDED") {
      data.suspendedAt = now;
      data.suspendedBy = actorUserId ?? null;
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { id: true, name: true, slug: true, status: true }
    });

    await this.audit({
      tenantId,
      actorUserId,
      action: "platform.tenant_status_update",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { status: input.status, reason: input.reason ?? null }
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
        include: {
          members: {
            where: { deletedAt: null },
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                  approvedAt: true,
                  rejectedAt: true,
                  rejectionReason: true,
                  suspendedAt: true
                }
              }
            }
          }
        },
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
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
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

  async userDetail(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        members: {
          where: { deletedAt: null },
          include: {
            tenant: {
              include: {
                usageLimit: true,
                usageCounter: true,
                creditBalance: true,
                subscriptions: { where: { deletedAt: null }, include: { plan: true }, orderBy: { createdAt: "desc" } },
                invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 },
                payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 },
                whatsappAccounts: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
                auditLogs: { orderBy: { createdAt: "desc" }, take: 20 }
              }
            }
          }
        }
      }
    });
    if (!user) throw notFound("User not found");

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      tenants: user.members.map((membership) => ({
        membershipId: membership.id,
        role: membership.role,
        status: membership.status,
        tenant: membership.tenant
      })),
      createdAt: user.createdAt.toISOString()
    };
  }

  async approveUser(userId: string, actorUserId?: string | null) {
    const tenantIds = await this.ownerTenantIdsForUser(userId);
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const result = await tx.tenant.updateMany({
        where: { id: { in: tenantIds }, deletedAt: null },
        data: {
          status: "APPROVED",
          approvedAt: now,
          approvedBy: actorUserId ?? null,
          rejectedAt: null,
          rejectionReason: null,
          suspendedAt: null,
          suspendedBy: null,
          approvalStatusChangedAt: now
        }
      });
      for (const tenantId of tenantIds) {
        await this.auditTx(tx, { tenantId, actorUserId, action: "admin.account_approved", entityType: "User", entityId: userId });
        await tx.notification.create({
          data: {
            tenantId,
            userId,
            title: "Account approved",
            body: "Your NovaChat AI workspace has been approved and is ready to use.",
            metadata: { type: "ACCOUNT_APPROVED", userId, tenantId }
          }
        });
      }
      return { userId, tenantIds, updated: result.count, status: "APPROVED" };
    });
  }

  async rejectUser(userId: string, input: AdminRejectAccountInput, actorUserId?: string | null) {
    const tenantIds = await this.ownerTenantIdsForUser(userId);
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const result = await tx.tenant.updateMany({
        where: { id: { in: tenantIds }, deletedAt: null },
        data: {
          status: "REJECTED",
          rejectedAt: now,
          rejectionReason: input.reason,
          approvalStatusChangedAt: now
        }
      });
      for (const tenantId of tenantIds) {
        await this.auditTx(tx, {
          tenantId,
          actorUserId,
          action: "admin.account_rejected",
          entityType: "User",
          entityId: userId,
          metadata: { reason: input.reason }
        });
        await tx.notification.create({
          data: {
            tenantId,
            userId,
            title: "Account rejected",
            body: input.reason,
            metadata: { type: "ACCOUNT_REJECTED", userId, tenantId }
          }
        });
      }
      return { userId, tenantIds, updated: result.count, status: "REJECTED" };
    });
  }

  async suspendUser(userId: string, input: AdminSuspendAccountInput, actorUserId?: string | null) {
    const tenantIds = await this.ownerTenantIdsForUser(userId);
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const result = await tx.tenant.updateMany({
        where: { id: { in: tenantIds }, deletedAt: null },
        data: {
          status: "SUSPENDED",
          suspendedAt: now,
          suspendedBy: actorUserId ?? null,
          approvalStatusChangedAt: now
        }
      });
      for (const tenantId of tenantIds) {
        await this.auditTx(tx, {
          tenantId,
          actorUserId,
          action: "admin.account_suspended",
          entityType: "User",
          entityId: userId,
          metadata: { reason: input.reason ?? null }
        });
      }
      return { userId, tenantIds, updated: result.count, status: "SUSPENDED" };
    });
  }

  async reactivateUser(userId: string, actorUserId?: string | null) {
    const tenantIds = await this.ownerTenantIdsForUser(userId);
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const result = await tx.tenant.updateMany({
        where: { id: { in: tenantIds }, deletedAt: null },
        data: {
          status: "APPROVED",
          suspendedAt: null,
          suspendedBy: null,
          reactivatedAt: now,
          reactivatedBy: actorUserId ?? null,
          approvalStatusChangedAt: now
        }
      });
      for (const tenantId of tenantIds) {
        await this.auditTx(tx, { tenantId, actorUserId, action: "admin.account_reactivated", entityType: "User", entityId: userId });
      }
      return { userId, tenantIds, updated: result.count, status: "APPROVED" };
    });
  }

  async changeUserPlan(userId: string, input: AdminChangePlanInput, actorUserId?: string | null) {
    const tenantId = await this.primaryOwnerTenantIdForUser(userId);
    const plan = await prisma.plan.findFirst({ where: { id: input.planId, deletedAt: null } });
    if (!plan) throw notFound("Plan not found");

    const now = new Date();
    const endAt = input.endAt ? new Date(input.endAt) : addDays(now, input.billingCycle === "YEARLY" ? 365 : 30);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: "desc" }
      });
      const subscription = existing
        ? await tx.subscription.update({
            where: { id: existing.id },
            data: {
              planId: plan.id,
              status: "ACTIVE",
              billingCycle: input.billingCycle,
              currentPeriodStart: now,
              currentPeriodEnd: endAt,
              startAt: existing.startAt ?? now,
              endAt,
              autoRenew: true,
              cancelAtPeriodEnd: false,
              cancelledAt: null
            }
          })
        : await tx.subscription.create({
            data: {
              tenantId,
              planId: plan.id,
              status: "ACTIVE",
              billingCycle: input.billingCycle,
              currentPeriodStart: now,
              currentPeriodEnd: endAt,
              startAt: now,
              endAt,
              autoRenew: true
            }
          });

      await tx.tenantUsageLimit.upsert({
        where: { tenantId },
        update: {
          planName: plan.name,
          billingStatus: "ACTIVE",
          aiMonthlyReplyLimit: plan.aiReplyLimit,
          whatsappMonthlyMessageLimit: plan.whatsappMessageLimit,
          billingCycleStart: now,
          billingCycleEnd: endAt
        },
        create: {
          tenantId,
          planName: plan.name,
          billingStatus: "ACTIVE",
          aiMonthlyReplyLimit: plan.aiReplyLimit,
          whatsappMonthlyMessageLimit: plan.whatsappMessageLimit,
          billingCycleStart: now,
          billingCycleEnd: endAt
        }
      });

      await this.auditTx(tx, {
        tenantId,
        actorUserId,
        action: "admin.plan_changed",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: { userId, planId: plan.id, billingCycle: input.billingCycle }
      });

      return { userId, tenantId, subscriptionId: subscription.id, plan: plan.name, status: subscription.status };
    });
  }

  async addUserUsageCredits(userId: string, input: AdminUsageCreditsInput, actorUserId?: string | null) {
    if (input.aiReplyCredits === 0 && input.whatsappMessageCredits === 0) {
      throw badRequest("At least one credit amount is required");
    }
    const tenantId = await this.primaryOwnerTenantIdForUser(userId);

    return prisma.$transaction(async (tx) => {
      const balance = await tx.tenantCreditBalance.upsert({
        where: { tenantId },
        update: {
          extraAiReplyCredits: { increment: input.aiReplyCredits },
          extraWhatsappMessageCredits: { increment: input.whatsappMessageCredits }
        },
        create: {
          tenantId,
          extraAiReplyCredits: input.aiReplyCredits,
          extraWhatsappMessageCredits: input.whatsappMessageCredits
        }
      });

      if (input.aiReplyCredits > 0) {
        await tx.creditTopUp.create({
          data: {
            tenantId,
            type: "AI_REPLY",
            quantity: input.aiReplyCredits,
            reason: input.reason ?? null,
            actorUserId: actorUserId ?? null
          }
        });
      }
      if (input.whatsappMessageCredits > 0) {
        await tx.creditTopUp.create({
          data: {
            tenantId,
            type: "WHATSAPP_MESSAGE",
            quantity: input.whatsappMessageCredits,
            reason: input.reason ?? null,
            actorUserId: actorUserId ?? null
          }
        });
      }
      await this.auditTx(tx, {
        tenantId,
        actorUserId,
        action: "admin.usage_credits_added",
        entityType: "TenantCreditBalance",
        entityId: balance.id,
        metadata: input
      });
      return balance;
    });
  }

  async plans() {
    const plans = await prisma.plan.findMany({ where: { deletedAt: null }, orderBy: { priceMonthly: "asc" } });
    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      monthlyPrice: decimalToNumber(plan.monthlyPrice),
      yearlyPrice: decimalToNumber(plan.yearlyPrice),
      currency: plan.currency,
      limits: plan.limits,
      aiReplyLimit: plan.aiReplyLimit,
      aiInputTokenLimit: plan.aiInputTokenLimit,
      aiOutputTokenLimit: plan.aiOutputTokenLimit,
      whatsappMessageLimit: plan.whatsappMessageLimit,
      agentLimit: plan.agentLimit,
      whatsappAccountLimit: plan.whatsappAccountLimit,
      knowledgeBaseStorageLimitBytes: plan.knowledgeBaseStorageLimitBytes.toString(),
      featuresJson: plan.featuresJson,
      isActive: plan.isActive,
      archivedAt: plan.archivedAt?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString()
    }));
  }

  async createPlan(input: AdminPlanInput, actorUserId?: string | null) {
    const code = input.code ?? slugify(input.name);
    const plan = await prisma.plan.create({
      data: {
        code,
        name: input.name,
        description: input.description ?? null,
        priceMonthly: input.monthlyPrice,
        monthlyPrice: input.monthlyPrice,
        yearlyPrice: input.yearlyPrice ?? input.monthlyPrice * 10,
        currency: input.currency,
        aiReplyLimit: input.aiReplyLimit,
        aiInputTokenLimit: input.aiInputTokenLimit,
        aiOutputTokenLimit: input.aiOutputTokenLimit,
        whatsappMessageLimit: input.whatsappMessageLimit,
        agentLimit: input.agentLimit,
        whatsappAccountLimit: input.whatsappAccountLimit,
        knowledgeBaseStorageLimitBytes: BigInt(input.knowledgeBaseStorageLimitBytes),
        featuresJson: input.featuresJson as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
        limits: planLimitsFromInput(input) as Prisma.InputJsonValue
      }
    });
    await this.audit({
      actorUserId,
      action: "admin.plan_created",
      entityType: "Plan",
      entityId: plan.id,
      metadata: { code: plan.code, name: plan.name }
    });
    return plan;
  }

  async updatePlan(planId: string, input: AdminPlanUpdateInput, actorUserId?: string | null) {
    const existing = await prisma.plan.findFirst({ where: { id: planId, deletedAt: null } });
    if (!existing) throw notFound("Plan not found");

    const nextLimits = {
      ...(existing.limits as Record<string, unknown>),
      ...planLimitsFromInput(input)
    };

    const data: Prisma.PlanUpdateInput = {
      limits: nextLimits as Prisma.InputJsonValue
    };
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.monthlyPrice !== undefined) {
      data.priceMonthly = input.monthlyPrice;
      data.monthlyPrice = input.monthlyPrice;
    }
    if (input.yearlyPrice !== undefined) data.yearlyPrice = input.yearlyPrice;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.aiReplyLimit !== undefined) data.aiReplyLimit = input.aiReplyLimit;
    if (input.aiInputTokenLimit !== undefined) data.aiInputTokenLimit = input.aiInputTokenLimit;
    if (input.aiOutputTokenLimit !== undefined) data.aiOutputTokenLimit = input.aiOutputTokenLimit;
    if (input.whatsappMessageLimit !== undefined) data.whatsappMessageLimit = input.whatsappMessageLimit;
    if (input.agentLimit !== undefined) data.agentLimit = input.agentLimit;
    if (input.whatsappAccountLimit !== undefined) data.whatsappAccountLimit = input.whatsappAccountLimit;
    if (input.knowledgeBaseStorageLimitBytes !== undefined) {
      data.knowledgeBaseStorageLimitBytes = BigInt(input.knowledgeBaseStorageLimitBytes);
    }
    if (input.featuresJson !== undefined) data.featuresJson = input.featuresJson as Prisma.InputJsonValue;
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
      data.archivedAt = input.isActive ? null : new Date();
    }

    const plan = await prisma.plan.update({
      where: { id: planId },
      data
    });
    await this.audit({
      actorUserId,
      action: "admin.plan_updated",
      entityType: "Plan",
      entityId: plan.id,
      metadata: input as Prisma.InputJsonValue
    });
    return plan;
  }

  async subscriptions(query: AdminListQuery) {
    const pagination = createPagination(query);
    const where: Prisma.SubscriptionWhereInput = { deletedAt: null };
    if (isSubscriptionStatus(query.status)) where.status = query.status;

    const [total, items] = await prisma.$transaction([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        include: { tenant: { select: { id: true, name: true, slug: true, status: true } }, plan: true },
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
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        autoRenew: subscription.autoRenew,
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
        include: { tenant: { select: { id: true, name: true, slug: true } }, invoice: true },
        orderBy: { createdAt: "desc" },
        take: 20
      })
    ]);

    return {
      invoices: {
        items: invoices.map((invoice) => ({
          id: invoice.id,
          tenant: invoice.tenant,
          number: invoice.invoiceNumber ?? invoice.number,
          status: invoice.status,
          total: decimalToNumber(invoice.total),
          currency: invoice.currency,
          createdAt: invoice.createdAt.toISOString()
        })),
        pagination: pagination.meta(invoiceTotal)
      },
      payments: {
        total: paymentTotal,
        items: payments.map((payment) => this.serializePayment(payment))
      }
    };
  }

  async invoices(query: AdminListQuery) {
    const billing = await this.billing(query);
    return billing.invoices;
  }

  async payments(query: AdminListQuery) {
    const pagination = createPagination(query);
    const where: Prisma.PaymentWhereInput = { deletedAt: null };
    if (isPaymentStatus(query.status)) where.status = query.status;
    const [total, items] = await prisma.$transaction([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          invoice: { select: { id: true, number: true, invoiceNumber: true, status: true, total: true } },
          paymentProofs: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 3 }
        },
        orderBy: { createdAt: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);
    return {
      items: items.map((payment) => this.serializePayment(payment)),
      pagination: pagination.meta(total)
    };
  }

  async approvePayment(paymentId: string, input: AdminPaymentReviewInput, actorUserId?: string | null) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
      include: { invoice: true }
    });
    if (!payment) throw notFound("Payment not found");
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          reviewedBy: actorUserId ?? null,
          reviewedAt: now,
          notes: input.notes ?? null
        }
      });
      if (payment.invoiceId) {
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: "PAID", paidAt: now }
        });
      }
      const subscriptionId = payment.subscriptionId ?? payment.invoice?.subscriptionId;
      if (subscriptionId) {
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { status: "ACTIVE", cancelledAt: null, cancelAtPeriodEnd: false }
        });
      }
      await this.auditTx(tx, {
        tenantId: payment.tenantId,
        actorUserId,
        action: "admin.payment_approved",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { notes: input.notes ?? null }
      });
      return updated;
    });
  }

  async rejectPayment(paymentId: string, input: AdminPaymentReviewInput, actorUserId?: string | null) {
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, deletedAt: null } });
    if (!payment) throw notFound("Payment not found");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          reviewedBy: actorUserId ?? null,
          reviewedAt: new Date(),
          notes: input.rejectionReason ?? input.notes ?? null
        }
      });
      await this.auditTx(tx, {
        tenantId: payment.tenantId,
        actorUserId,
        action: "admin.payment_rejected",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { reason: input.rejectionReason ?? input.notes ?? null }
      });
      return updated;
    });
  }

  async usage() {
    const [counters, records] = await Promise.all([
      prisma.tenantUsageCounter.findMany({
        where: { deletedAt: null },
        include: { tenant: { select: { id: true, name: true, slug: true, status: true, usageLimit: true, creditBalance: true } } },
        orderBy: { updatedAt: "desc" },
        take: 50
      }),
      prisma.usageRecord.findMany({
        include: { tenant: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ]);

    return {
      tenants: counters.map((counter) => ({
        tenant: counter.tenant,
        aiRepliesUsedThisMonth: counter.aiRepliesUsedThisMonth,
        whatsappMessagesUsedThisMonth: counter.whatsappMessagesUsedThisMonth,
        aiInputTokensUsed: counter.aiInputTokensUsed,
        aiOutputTokensUsed: counter.aiOutputTokensUsed,
        aiCostUsedThisMonth: decimalToNumber(counter.aiCostUsedThisMonth),
        aiDisabledDueToLimit: counter.aiDisabledDueToLimit,
        whatsappDisabledDueToLimit: counter.whatsappDisabledDueToLimit
      })),
      recentRecords: records.map((record) => ({
        id: record.id,
        tenant: record.tenant,
        type: record.type,
        quantity: record.quantity,
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        estimatedCost: decimalToNumber(record.estimatedCost),
        createdAt: record.createdAt.toISOString()
      }))
    };
  }

  async notifications(query: AdminListQuery) {
    const pagination = createPagination(query);
    const [total, items] = await prisma.$transaction([
      prisma.notification.count({ where: { deletedAt: null } }),
      prisma.notification.findMany({
        where: { deletedAt: null },
        include: { tenant: { select: { id: true, name: true, slug: true } }, user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);
    return {
      items: items.map((notification) => ({
        id: notification.id,
        tenant: notification.tenant,
        user: notification.user,
        title: notification.title,
        body: notification.body,
        status: notification.status,
        metadata: notification.metadata,
        createdAt: notification.createdAt.toISOString()
      })),
      pagination: pagination.meta(total)
    };
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
    const [tenants, users, messages, failedAiLogs, failedCampaigns, connectedWhatsApp] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.aiLog.count({ where: { status: "FAILED" } }),
      prisma.campaignRecipient.count({ where: { status: "FAILED", deletedAt: null } }),
      prisma.whatsAppAccount.count({ where: { deletedAt: null, status: "CONNECTED" } })
    ]);

    return {
      status: "operational",
      database: "connected",
      redis: "configured",
      queues: ["knowledge", "usage", "campaign", "whatsapp-outbound"],
      checks: { tenants, users, messages, failedAiLogs, failedCampaigns, connectedWhatsApp },
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

  private async ownerTenantIdsForUser(userId: string) {
    const memberships = await prisma.tenantMember.findMany({
      where: { userId, role: "OWNER", deletedAt: null },
      select: { tenantId: true }
    });
    if (memberships.length === 0) throw notFound("Owner tenant not found for this user");
    return memberships.map((membership) => membership.tenantId);
  }

  private async primaryOwnerTenantIdForUser(userId: string) {
    const [tenantId] = await this.ownerTenantIdsForUser(userId);
    if (!tenantId) throw notFound("Owner tenant not found for this user");
    return tenantId;
  }

  private serializePayment(payment: {
    id: string;
    status: string;
    amount: Prisma.Decimal;
    currency: string;
    provider: string | null;
    method: string | null;
    transactionReference?: string | null;
    reviewedAt?: Date | null;
    createdAt: Date;
    tenant?: { id: string; name: string; slug: string } | null;
    invoice?: { id: string; number: string; invoiceNumber?: string | null; status: string; total?: Prisma.Decimal } | null;
    paymentProofs?: Array<{ id: string; storageUrl: string; fileName: string; status: string; createdAt: Date }>;
  }) {
    return {
      id: payment.id,
      tenant: payment.tenant,
      invoice: payment.invoice
        ? {
            id: payment.invoice.id,
            number: payment.invoice.invoiceNumber ?? payment.invoice.number,
            status: payment.invoice.status,
            total: payment.invoice.total ? decimalToNumber(payment.invoice.total) : undefined
          }
        : null,
      status: payment.status,
      amount: decimalToNumber(payment.amount),
      currency: payment.currency,
      provider: payment.provider,
      method: payment.method,
      transactionReference: payment.transactionReference,
      reviewedAt: payment.reviewedAt?.toISOString() ?? null,
      proofs: payment.paymentProofs?.map((proof) => ({
        id: proof.id,
        storageUrl: proof.storageUrl,
        fileName: proof.fileName,
        status: proof.status,
        createdAt: proof.createdAt.toISOString()
      })),
      createdAt: payment.createdAt.toISOString()
    };
  }

  private async audit(params: {
    tenantId?: string | null | undefined;
    actorUserId?: string | null | undefined;
    action: string;
    entityType: string;
    entityId?: string | null | undefined;
    metadata?: Prisma.InputJsonValue | undefined;
  }) {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId ?? null,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? Prisma.JsonNull
      }
    });
  }

  private async auditTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId?: string | null | undefined;
      actorUserId?: string | null | undefined;
      action: string;
      entityType: string;
      entityId?: string | null | undefined;
      metadata?: Prisma.InputJsonValue | undefined;
    }
  ) {
    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId ?? null,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? Prisma.JsonNull
      }
    });
  }
}

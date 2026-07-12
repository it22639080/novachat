import { Prisma, prisma } from "@novachat/database";
import type {
  BillingCancelInput,
  BillingInvoicesQuery,
  BillingSubscribeInput,
  BillingUpgradeInput,
  BillingWebhookInput,
  PlanInput,
  PlanLimits,
  PlanUpdateInput
} from "@novachat/shared-types";
import { badRequest, notFound, paymentRequired } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { UsageService } from "./usage-service.js";

const usageService = new UsageService();

type BillingPlanCode = "starter" | "business" | "professional" | "enterprise";

const defaultPlanCatalog: Record<BillingPlanCode, PlanInput> = {
  starter: {
    code: "starter",
    name: "Starter",
    description: "For small teams starting WhatsApp support automation.",
    priceMonthly: 19,
    currency: "USD",
    isActive: true,
    limits: {
      whatsappAccounts: 1,
      teamMembers: 3,
      aiMonthlyReplies: 1000,
      monthlyConversations: 1000,
      monthlyCampaignSends: 1000,
      knowledgeBaseStorageMb: 250,
      chatbots: 2,
      advancedAnalytics: false,
      integrations: false,
      dailyAiCostLimit: 2,
      monthlyAiCostLimit: 30
    }
  },
  business: {
    code: "business",
    name: "Business",
    description: "For growing businesses with CRM, campaigns, and AI automation.",
    priceMonthly: 59,
    currency: "USD",
    isActive: true,
    limits: {
      whatsappAccounts: 3,
      teamMembers: 10,
      aiMonthlyReplies: 10000,
      monthlyConversations: 10000,
      monthlyCampaignSends: 20000,
      knowledgeBaseStorageMb: 2000,
      chatbots: 10,
      advancedAnalytics: true,
      integrations: false,
      dailyAiCostLimit: 10,
      monthlyAiCostLimit: 150
    }
  },
  professional: {
    code: "professional",
    name: "Professional",
    description: "For multi-team operators that need advanced analytics and integrations.",
    priceMonthly: 149,
    currency: "USD",
    isActive: true,
    limits: {
      whatsappAccounts: 10,
      teamMembers: 50,
      aiMonthlyReplies: 50000,
      monthlyConversations: 50000,
      monthlyCampaignSends: 100000,
      knowledgeBaseStorageMb: 10000,
      chatbots: 50,
      advancedAnalytics: true,
      integrations: true,
      dailyAiCostLimit: 35,
      monthlyAiCostLimit: 600
    }
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    description: "Custom limits for high-volume businesses and agencies.",
    priceMonthly: 499,
    currency: "USD",
    isActive: true,
    limits: {
      whatsappAccounts: 100,
      teamMembers: 1000,
      aiMonthlyReplies: 500000,
      monthlyConversations: 500000,
      monthlyCampaignSends: 1000000,
      knowledgeBaseStorageMb: 100000,
      chatbots: 500,
      advancedAnalytics: true,
      integrations: true,
      dailyAiCostLimit: 250,
      monthlyAiCostLimit: 5000
    }
  }
};

function nextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function parseLimits(value: Prisma.JsonValue): PlanLimits {
  return value as unknown as PlanLimits;
}

function invoiceNumber() {
  return `NV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function serializePlan(plan: PlanRecord) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceMonthly: decimalToNumber(plan.priceMonthly),
    currency: plan.currency,
    limits: parseLimits(plan.limits),
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString()
  };
}

function serializeSubscription(subscription: SubscriptionRecord | null) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    externalSubscription: subscription.externalSubscription,
    plan: serializePlan(subscription.plan),
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString()
  };
}

function serializeInvoice(invoice: InvoiceRecord) {
  return {
    id: invoice.id,
    subscriptionId: invoice.subscriptionId,
    number: invoice.number,
    status: invoice.status,
    subtotal: decimalToNumber(invoice.subtotal),
    tax: decimalToNumber(invoice.tax),
    total: decimalToNumber(invoice.total),
    currency: invoice.currency,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: decimalToNumber(payment.amount),
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      externalId: payment.externalId,
      createdAt: payment.createdAt.toISOString()
    })),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString()
  };
}

type PlanRecord = Prisma.PlanGetPayload<Record<string, never>>;
type SubscriptionRecord = Prisma.SubscriptionGetPayload<{ include: { plan: true } }>;
type InvoiceRecord = Prisma.InvoiceGetPayload<{ include: { payments: true } }>;

export class BillingService {
  async ensureDefaultPlans(tx: Prisma.TransactionClient = prisma) {
    const plans = [];
    for (const plan of Object.values(defaultPlanCatalog)) {
      plans.push(
        await tx.plan.upsert({
          where: { code: plan.code },
          update: {
            name: plan.name,
            description: plan.description ?? null,
            priceMonthly: new Prisma.Decimal(plan.priceMonthly),
            currency: plan.currency,
            limits: plan.limits as Prisma.InputJsonValue,
            isActive: plan.isActive,
            deletedAt: null
          },
          create: {
            code: plan.code,
            name: plan.name,
            description: plan.description ?? null,
            priceMonthly: new Prisma.Decimal(plan.priceMonthly),
            currency: plan.currency,
            limits: plan.limits as Prisma.InputJsonValue,
            isActive: plan.isActive
          }
        })
      );
    }
    return plans;
  }

  async plans() {
    await this.ensureDefaultPlans();
    const plans = await prisma.plan.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { priceMonthly: "asc" }
    });
    return plans.map(serializePlan);
  }

  async createPlan(input: PlanInput) {
    const plan = await prisma.plan.upsert({
      where: { code: input.code },
      update: {
        name: input.name,
        description: input.description ?? null,
        priceMonthly: new Prisma.Decimal(input.priceMonthly),
        currency: input.currency,
        limits: input.limits as Prisma.InputJsonValue,
        isActive: input.isActive,
        deletedAt: null
      },
      create: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        priceMonthly: new Prisma.Decimal(input.priceMonthly),
        currency: input.currency,
        limits: input.limits as Prisma.InputJsonValue,
        isActive: input.isActive
      }
    });
    return serializePlan(plan);
  }

  async updatePlan(code: string, input: PlanUpdateInput) {
    const existing = await prisma.plan.findFirst({ where: { code, deletedAt: null } });
    if (!existing) throw notFound("Plan not found");
    const plan = await prisma.plan.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.priceMonthly !== undefined ? { priceMonthly: new Prisma.Decimal(input.priceMonthly) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.limits !== undefined ? { limits: input.limits as Prisma.InputJsonValue } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });
    return serializePlan(plan);
  }

  async subscription(tenantId: string) {
    await this.ensureDefaultPlans();
    const subscription = await this.currentSubscription(tenantId);
    return serializeSubscription(subscription);
  }

  async subscribe(tenantId: string, input: BillingSubscribeInput) {
    return this.createOrMoveSubscription(tenantId, input.planCode, input.trialDays, input.provider, "subscribe");
  }

  async upgrade(tenantId: string, input: BillingUpgradeInput) {
    return this.createOrMoveSubscription(tenantId, input.planCode, 0, input.provider, "upgrade");
  }

  async cancel(tenantId: string, input: BillingCancelInput) {
    const subscription = await this.currentSubscription(tenantId);
    if (!subscription) throw notFound("Subscription not found");

    const updated = await prisma.$transaction(async (tx) => {
      const data = input.cancelAtPeriodEnd
        ? { cancelAtPeriodEnd: true }
        : { status: "CANCELED" as const, cancelAtPeriodEnd: false };
      const canceled = await tx.subscription.update({
        where: { id: subscription.id },
        data,
        include: { plan: true }
      });
      await tx.tenantUsageLimit.updateMany({
        where: { tenantId },
        data: { billingStatus: input.cancelAtPeriodEnd ? "ACTIVE" : "CANCELED" }
      });
      return canceled;
    });

    return {
      subscription: serializeSubscription(updated),
      message: input.cancelAtPeriodEnd ? "Subscription will cancel at period end." : "Subscription canceled immediately.",
      reason: input.reason ?? null
    };
  }

  async invoices(tenantId: string, query: BillingInvoicesQuery) {
    const pagination = createPagination(query);
    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {})
    };
    const [total, items] = await prisma.$transaction([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: { payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } } },
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);
    return { items: items.map(serializeInvoice), pagination: pagination.meta(total) };
  }

  async usage(tenantId: string) {
    await this.ensureDefaultPlans();
    const [summary, counts, subscription] = await Promise.all([
      usageService.getSummary(tenantId),
      this.countCurrentUsage(tenantId),
      this.currentSubscription(tenantId)
    ]);
    const plan = subscription?.plan ?? (await prisma.plan.findUnique({ where: { code: "starter" } }));
    const limits = plan ? parseLimits(plan.limits) : defaultPlanCatalog.starter.limits;

    return {
      summary,
      counts,
      limits,
      allowances: {
        whatsappAccounts: this.allowance(counts.whatsappAccounts, limits.whatsappAccounts),
        teamMembers: this.allowance(counts.teamMembers, limits.teamMembers),
        monthlyConversations: this.allowance(counts.monthlyConversations, limits.monthlyConversations),
        monthlyCampaignSends: this.allowance(counts.monthlyCampaignSends, limits.monthlyCampaignSends),
        knowledgeBaseStorageMb: this.allowance(counts.knowledgeBaseStorageMb, limits.knowledgeBaseStorageMb),
        chatbots: this.allowance(counts.chatbots, limits.chatbots),
        advancedAnalytics: { enabled: limits.advancedAnalytics },
        integrations: { enabled: limits.integrations }
      }
    };
  }

  async assertPlanAllowance(
    tenantId: string,
    key:
      | "whatsappAccounts"
      | "teamMembers"
      | "monthlyConversations"
      | "monthlyCampaignSends"
      | "knowledgeBaseStorageMb"
      | "chatbots",
    increment = 1
  ) {
    await this.ensureDefaultPlans();
    const subscription = await this.currentSubscription(tenantId);
    const plan = subscription?.plan ?? (await prisma.plan.findUnique({ where: { code: "starter" } }));
    const limits = plan ? parseLimits(plan.limits) : defaultPlanCatalog.starter.limits;
    const counts = await this.countCurrentUsage(tenantId);
    const used = counts[key] + increment;
    const limit = limits[key];

    if (used > limit) {
      throw paymentRequired(
        "PLAN_LIMIT_REACHED",
        `${key} limit reached for the current plan. Upgrade the subscription to continue.`,
        { key, used: counts[key], attempted: increment, limit, planName: plan?.name ?? "Starter" }
      );
    }

    return { used: counts[key], attempted: increment, limit, remaining: Math.max(0, limit - used) };
  }

  async assertAdvancedAnalytics(tenantId: string) {
    await this.ensureDefaultPlans();
    const subscription = await this.currentSubscription(tenantId);
    const plan = subscription?.plan ?? (await prisma.plan.findUnique({ where: { code: "starter" } }));
    const limits = plan ? parseLimits(plan.limits) : defaultPlanCatalog.starter.limits;

    if (!limits.advancedAnalytics) {
      throw paymentRequired(
        "ADVANCED_ANALYTICS_REQUIRED",
        "Advanced analytics is not available on the current plan. Upgrade to Business or higher.",
        { planName: plan?.name ?? "Starter" }
      );
    }
  }

  async webhook(provider: "stripe" | "payhere", input: BillingWebhookInput) {
    return {
      received: true,
      provider,
      eventType: input.eventType ?? "placeholder",
      message: `${provider} webhook placeholder received. Signature validation and payment reconciliation will be added with live provider credentials.`
    };
  }

  private async createOrMoveSubscription(
    tenantId: string,
    planCode: BillingPlanCode,
    trialDays: number,
    provider: "manual" | "stripe" | "payhere",
    action: "subscribe" | "upgrade"
  ) {
    await this.ensureDefaultPlans();
    const plan = await prisma.plan.findFirst({ where: { code: planCode, isActive: true, deletedAt: null } });
    if (!plan) throw notFound("Plan not found");
    const now = new Date();
    const periodEnd = nextMonth(now);
    const trialEndsAt = trialDays > 0 ? addDays(now, trialDays) : null;
    const limits = parseLimits(plan.limits);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findFirst({
        where: { tenantId, deletedAt: null, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
        include: { plan: true },
        orderBy: { createdAt: "desc" }
      });

      const subscription = existing
        ? await tx.subscription.update({
            where: { id: existing.id },
            data: {
              planId: plan.id,
              status: trialEndsAt ? "TRIALING" : "ACTIVE",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              trialEndsAt,
              cancelAtPeriodEnd: false,
              externalSubscription: provider === "manual" ? null : `${provider}_placeholder_${existing.id}`
            },
            include: { plan: true }
          })
        : await tx.subscription.create({
            data: {
              tenantId,
              planId: plan.id,
              status: trialEndsAt ? "TRIALING" : "ACTIVE",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              trialEndsAt,
              externalSubscription: provider === "manual" ? null : `${provider}_placeholder_${tenantId}`
            },
            include: { plan: true }
          });

      await tx.tenantUsageLimit.upsert({
        where: { tenantId },
        update: {
          planName: plan.name,
          billingStatus: trialEndsAt ? "TRIALING" : "ACTIVE",
          aiMonthlyReplyLimit: limits.aiMonthlyReplies,
          whatsappMonthlyMessageLimit: limits.monthlyCampaignSends + limits.monthlyConversations,
          dailyAiCostLimit: new Prisma.Decimal(limits.dailyAiCostLimit),
          monthlyAiCostLimit: new Prisma.Decimal(limits.monthlyAiCostLimit),
          billingCycleStart: now,
          billingCycleEnd: periodEnd
        },
        create: {
          tenantId,
          planName: plan.name,
          billingStatus: trialEndsAt ? "TRIALING" : "ACTIVE",
          aiMonthlyReplyLimit: limits.aiMonthlyReplies,
          whatsappMonthlyMessageLimit: limits.monthlyCampaignSends + limits.monthlyConversations,
          dailyAiCostLimit: new Prisma.Decimal(limits.dailyAiCostLimit),
          monthlyAiCostLimit: new Prisma.Decimal(limits.monthlyAiCostLimit),
          billingCycleStart: now,
          billingCycleEnd: periodEnd
        }
      });
      await tx.tenantUsageCounter.upsert({ where: { tenantId }, update: {}, create: { tenantId } });
      await tx.tenantCreditBalance.upsert({ where: { tenantId }, update: {}, create: { tenantId } });

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          number: invoiceNumber(),
          status: plan.priceMonthly.equals(0) || trialEndsAt ? "PAID" : "OPEN",
          subtotal: plan.priceMonthly,
          tax: new Prisma.Decimal(0),
          total: plan.priceMonthly,
          currency: plan.currency,
          dueAt: trialEndsAt ? trialEndsAt : addDays(now, 7),
          paidAt: plan.priceMonthly.equals(0) || trialEndsAt ? now : null
        },
        include: { payments: true }
      });

      if (!plan.priceMonthly.equals(0)) {
        await tx.payment.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            subscriptionId: subscription.id,
            amount: plan.priceMonthly,
            currency: plan.currency,
            status: trialEndsAt ? "PENDING" : "PENDING",
            provider,
            externalId: provider === "manual" ? null : `${provider}_payment_placeholder_${invoice.id}`
          }
        });
      }

      return {
        subscription,
        invoice: await tx.invoice.findFirstOrThrow({
          where: { id: invoice.id },
          include: { payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } } }
        })
      };
    });

    return {
      action,
      subscription: serializeSubscription(result.subscription),
      invoice: serializeInvoice(result.invoice),
      payment: {
        provider,
        checkoutUrl: provider === "manual" ? null : null,
        message:
          provider === "manual"
            ? "Manual billing placeholder created."
            : `${provider} checkout placeholder created. Add live provider credentials in a later integration phase.`
      }
    };
  }

  private async currentSubscription(tenantId: string) {
    return prisma.subscription.findFirst({
      where: { tenantId, deletedAt: null },
      include: { plan: true },
      orderBy: { createdAt: "desc" }
    });
  }

  private allowance(used: number, limit: number) {
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      exceeded: used >= limit,
      ratio: limit > 0 ? used / limit : 1
    };
  }

  private async countCurrentUsage(tenantId: string) {
    const [whatsappAccounts, teamMembers, monthlyConversations, monthlyCampaignSends, chatbots, documents] =
      await Promise.all([
        prisma.whatsAppAccount.count({ where: { tenantId, deletedAt: null } }),
        prisma.tenantMember.count({ where: { tenantId, deletedAt: null } }),
        prisma.conversation.count({
          where: {
            tenantId,
            deletedAt: null,
            createdAt: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)) }
          }
        }),
        prisma.campaignRecipient.count({
          where: {
            tenantId,
            deletedAt: null,
            status: { in: ["SENT", "DELIVERED", "READ", "REPLIED"] },
            createdAt: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)) }
          }
        }),
        prisma.chatbot.count({ where: { tenantId, deletedAt: null } }),
        prisma.knowledgeBaseDocument.findMany({
          where: { tenantId, deletedAt: null },
          select: { fileSize: true }
        })
      ]);

    return {
      whatsappAccounts,
      teamMembers,
      monthlyConversations,
      monthlyCampaignSends,
      chatbots,
      knowledgeBaseStorageMb: Math.ceil(documents.reduce((sum, doc) => sum + (doc.fileSize ?? 0), 0) / (1024 * 1024))
    };
  }
}

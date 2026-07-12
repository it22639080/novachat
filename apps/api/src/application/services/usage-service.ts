import { Prisma, prisma } from "@novachat/database";
import type {
  AddTenantCreditsInput,
  ResetTenantUsageInput,
  UpdateTenantLimitsInput,
  UpdateTenantModelInput,
  UsageCostsQuery,
  UsageEventsQuery
} from "@novachat/shared-types";
import { createPagination } from "../../shared/pagination/create-pagination.js";
import { notFound, paymentRequired } from "../../shared/errors/app-error.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { costLimitReached, evaluateAllowance, usageRatio, warningThresholdsCrossed } from "../usage/usage-policy.js";

type Tx = Prisma.TransactionClient;

type Reservation = {
  consumedCredit: boolean;
};

const defaultAiModel = "gpt-4o-mini";
const invalidModelAliases: Record<string, string> = {
  "gpt-4.0-mini": defaultAiModel,
  "gpt-4.1-mini": defaultAiModel
};

const modelPricingUsdPerMillionTokens: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 }
};

function normalizeModelName(modelName: string | null | undefined) {
  const normalized = modelName?.trim();
  if (!normalized) {
    return defaultAiModel;
  }

  return invalidModelAliases[normalized] ?? normalized;
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function nextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function estimateAiCost(modelName: string, inputTokens: number, outputTokens: number) {
  const pricing = modelPricingUsdPerMillionTokens[normalizeModelName(modelName)] ?? {
    input: 0.15,
    output: 0.6
  };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

function serializeSummary(input: {
  limit: Prisma.TenantUsageLimitGetPayload<Record<string, never>>;
  counter: Prisma.TenantUsageCounterGetPayload<Record<string, never>>;
  credit: Prisma.TenantCreditBalanceGetPayload<Record<string, never>>;
}) {
  const aiRatio = usageRatio(input.counter.aiRepliesUsedThisMonth, input.limit.aiMonthlyReplyLimit);
  const whatsAppRatio = usageRatio(
    input.counter.whatsappMessagesUsedThisMonth,
    input.limit.whatsappMonthlyMessageLimit
  );
  const dailyCostRatio = usageRatio(
    decimalToNumber(input.counter.aiCostUsedToday),
    decimalToNumber(input.limit.dailyAiCostLimit)
  );
  const monthlyCostRatio = usageRatio(
    decimalToNumber(input.counter.aiCostUsedThisMonth),
    decimalToNumber(input.limit.monthlyAiCostLimit)
  );

  return {
    planName: input.limit.planName,
    billingStatus: input.limit.billingStatus,
    aiMonthlyReplyLimit: input.limit.aiMonthlyReplyLimit,
    aiRepliesUsedThisMonth: input.counter.aiRepliesUsedThisMonth,
    aiInputTokensUsed: input.counter.aiInputTokensUsed,
    aiOutputTokensUsed: input.counter.aiOutputTokensUsed,
    whatsappMonthlyMessageLimit: input.limit.whatsappMonthlyMessageLimit,
    whatsappMessagesUsedThisMonth: input.counter.whatsappMessagesUsedThisMonth,
    extraAiReplyCredits: input.credit.extraAiReplyCredits,
    extraWhatsappMessageCredits: input.credit.extraWhatsappMessageCredits,
    aiDisabledDueToLimit: input.counter.aiDisabledDueToLimit,
    whatsappDisabledDueToLimit: input.counter.whatsappDisabledDueToLimit,
    currentAiModel: input.limit.currentAiModel,
    dailyAiCostLimit: decimalToNumber(input.limit.dailyAiCostLimit),
    monthlyAiCostLimit: decimalToNumber(input.limit.monthlyAiCostLimit),
    aiCostUsedToday: decimalToNumber(input.counter.aiCostUsedToday),
    aiCostUsedThisMonth: decimalToNumber(input.counter.aiCostUsedThisMonth),
    billingCycleStart: input.limit.billingCycleStart.toISOString(),
    billingCycleEnd: input.limit.billingCycleEnd?.toISOString() ?? null,
    lastUsageResetAt: input.counter.lastUsageResetAt?.toISOString() ?? null,
    warnings: {
      aiReplies: warningThresholdsCrossed(aiRatio),
      whatsappMessages: warningThresholdsCrossed(whatsAppRatio),
      dailyAiCost: warningThresholdsCrossed(dailyCostRatio),
      monthlyAiCost: warningThresholdsCrossed(monthlyCostRatio)
    }
  };
}

export class UsageService {
  async ensureUsageState(tenantId: string, tx: Tx = prisma) {
    const tenant = await tx.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { id: true }
    });

    if (!tenant) {
      throw notFound("Tenant not found");
    }

    const [limit, counter, credit] = await Promise.all([
      tx.tenantUsageLimit.upsert({
        where: { tenantId },
        update: {},
        create: {
          tenantId,
          currentAiModel: defaultAiModel,
          billingCycleStart: new Date(),
          billingCycleEnd: nextMonth()
        }
      }),
      tx.tenantUsageCounter.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId }
      }),
      tx.tenantCreditBalance.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId }
      })
    ]);

    const normalizedModel = normalizeModelName(limit.currentAiModel);
    const normalizedLimit =
      normalizedModel === limit.currentAiModel
        ? limit
        : await tx.tenantUsageLimit.update({
            where: { id: limit.id },
            data: { currentAiModel: normalizedModel }
          });

    return { limit: normalizedLimit, counter, credit };
  }

  async getSummary(tenantId: string) {
    return serializeSummary(await this.ensureUsageState(tenantId));
  }

  async getAdminTenantSummary(tenantId: string) {
    return this.getSummary(tenantId);
  }

  async getCurrentAiModel(tenantId: string) {
    const { limit } = await this.ensureUsageState(tenantId);
    return normalizeModelName(limit.currentAiModel);
  }

  async listEvents(tenantId: string, query: UsageEventsQuery) {
    await this.ensureUsageState(tenantId);
    const pagination = createPagination(query);
    const where = {
      tenantId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {})
            }
          }
        : {})
    };
    const [items, total] = await prisma.$transaction([
      prisma.usageEvent.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.usageEvent.count({ where })
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        quantity: item.quantity,
        costEstimate: decimalToNumber(item.costEstimate),
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString()
      })),
      pagination: pagination.meta(total)
    };
  }

  async getCosts(tenantId: string, query: UsageCostsQuery) {
    await this.ensureUsageState(tenantId);
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - query.days + 1);
    from.setUTCHours(0, 0, 0, 0);

    const events = await prisma.usageEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: from },
        type: { in: ["AI_REPLY", "AI_INPUT_TOKEN", "AI_OUTPUT_TOKEN", "WHATSAPP_MESSAGE"] }
      },
      orderBy: { createdAt: "asc" }
    });

    const byDay = new Map<
      string,
      { date: string; aiReplies: number; whatsappMessages: number; aiCost: number; inputTokens: number; outputTokens: number }
    >();

    for (const event of events) {
      const key = dateKey(event.createdAt);
      const row =
        byDay.get(key) ??
        {
          date: key,
          aiReplies: 0,
          whatsappMessages: 0,
          aiCost: 0,
          inputTokens: 0,
          outputTokens: 0
        };

      if (event.type === "AI_REPLY") {
        row.aiReplies += event.quantity;
      }

      if (event.type === "WHATSAPP_MESSAGE") {
        row.whatsappMessages += event.quantity;
      }

      if (event.type === "AI_INPUT_TOKEN") {
        row.inputTokens += event.quantity;
      }

      if (event.type === "AI_OUTPUT_TOKEN") {
        row.outputTokens += event.quantity;
      }

      row.aiCost += decimalToNumber(event.costEstimate);
      byDay.set(key, row);
    }

    return {
      days: Array.from(byDay.values())
    };
  }

  async reserveAiReply(tenantId: string): Promise<Reservation & { modelName: string }> {
    return prisma.$transaction(
      async (tx) => {
        const { limit, counter, credit } = await this.ensureUsageState(tenantId, tx);
        const modelName = normalizeModelName(limit.currentAiModel);

        if (counter.aiDisabledDueToLimit) {
          throw paymentRequired(
            "AI_USAGE_LIMIT_REACHED",
            "AI is disabled because this tenant reached its AI usage or cost limit."
          );
        }

        if (
          costLimitReached(decimalToNumber(counter.aiCostUsedToday), decimalToNumber(limit.dailyAiCostLimit)) ||
          costLimitReached(decimalToNumber(counter.aiCostUsedThisMonth), decimalToNumber(limit.monthlyAiCostLimit))
        ) {
          await this.disableAiForLimit(tenantId, tx, "AI cost limit reached");
          throw paymentRequired(
            "AI_COST_LIMIT_REACHED",
            "AI is disabled because this tenant reached its AI cost limit."
          );
        }

        const allowance = evaluateAllowance(
          counter.aiRepliesUsedThisMonth,
          limit.aiMonthlyReplyLimit,
          credit.extraAiReplyCredits
        );

        if (!allowance.allowed) {
          await this.disableAiForLimit(tenantId, tx, "AI reply limit reached");
          throw paymentRequired(
            "AI_REPLY_LIMIT_REACHED",
            "AI reply limit reached. Add extra AI credits or upgrade the plan."
          );
        }

        await tx.tenantUsageCounter.update({
          where: { tenantId },
          data: { aiRepliesUsedThisMonth: { increment: 1 } }
        });

        if (allowance.shouldConsumeCredit) {
          await tx.tenantCreditBalance.update({
            where: { tenantId },
            data: { extraAiReplyCredits: { decrement: 1 } }
          });
        }

        return {
          modelName,
          consumedCredit: allowance.shouldConsumeCredit
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async releaseAiReplyReservation(tenantId: string, reservation: Reservation) {
    await prisma.$transaction(async (tx) => {
      await tx.tenantUsageCounter.update({
        where: { tenantId },
        data: { aiRepliesUsedThisMonth: { decrement: 1 } }
      });

      if (reservation.consumedCredit) {
        await tx.tenantCreditBalance.update({
          where: { tenantId },
          data: { extraAiReplyCredits: { increment: 1 } }
        });
      }
    });
  }

  async recordAiUsage(input: {
    tenantId: string;
    modelName: string;
    promptTokens: number;
    outputTokens: number;
    conversationId?: string;
    fallbackUsed?: boolean;
  }) {
    const cost = estimateAiCost(input.modelName, input.promptTokens, input.outputTokens);

    const updatedCounter = await prisma.$transaction(
      async (tx) => {
        const { limit } = await this.ensureUsageState(input.tenantId, tx);
        const counter = await tx.tenantUsageCounter.update({
          where: { tenantId: input.tenantId },
          data: {
            aiInputTokensUsed: { increment: input.promptTokens },
            aiOutputTokensUsed: { increment: input.outputTokens },
            aiCostUsedToday: { increment: cost },
            aiCostUsedThisMonth: { increment: cost }
          }
        });

        await tx.usageEvent.createMany({
          data: [
            {
              tenantId: input.tenantId,
              type: "AI_REPLY",
              quantity: 1,
              costEstimate: cost,
              metadata: {
                modelName: input.modelName,
                conversationId: input.conversationId ?? null,
                fallbackUsed: Boolean(input.fallbackUsed)
              }
            },
            {
              tenantId: input.tenantId,
              type: "AI_INPUT_TOKEN",
              quantity: input.promptTokens,
              costEstimate: estimateAiCost(input.modelName, input.promptTokens, 0),
              metadata: { modelName: input.modelName }
            },
            {
              tenantId: input.tenantId,
              type: "AI_OUTPUT_TOKEN",
              quantity: input.outputTokens,
              costEstimate: estimateAiCost(input.modelName, 0, input.outputTokens),
              metadata: { modelName: input.modelName }
            }
          ]
        });

        if (
          costLimitReached(decimalToNumber(counter.aiCostUsedToday), decimalToNumber(limit.dailyAiCostLimit)) ||
          costLimitReached(decimalToNumber(counter.aiCostUsedThisMonth), decimalToNumber(limit.monthlyAiCostLimit))
        ) {
          await this.disableAiForLimit(input.tenantId, tx, "AI cost limit reached after response");
        }

        return counter;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await this.notifyCostWarnings(input.tenantId, updatedCounter);
  }

  async reserveWhatsappMessage(tenantId: string): Promise<Reservation> {
    return prisma.$transaction(
      async (tx) => {
        const { limit, counter, credit } = await this.ensureUsageState(tenantId, tx);

        if (counter.whatsappDisabledDueToLimit) {
          throw paymentRequired(
            "WHATSAPP_USAGE_LIMIT_REACHED",
            "WhatsApp sending is disabled because this tenant reached its monthly message limit."
          );
        }

        const allowance = evaluateAllowance(
          counter.whatsappMessagesUsedThisMonth,
          limit.whatsappMonthlyMessageLimit,
          credit.extraWhatsappMessageCredits
        );

        if (!allowance.allowed) {
          await tx.tenantUsageCounter.update({
            where: { tenantId },
            data: { whatsappDisabledDueToLimit: true }
          });
          await this.createUsageNotification(
            tenantId,
            "WhatsApp message limit reached",
            "Outgoing WhatsApp messages are blocked until credits are added or the plan resets.",
            { type: "WHATSAPP_MESSAGE_LIMIT_REACHED" },
            tx
          );
          throw paymentRequired(
            "WHATSAPP_MESSAGE_LIMIT_REACHED",
            "WhatsApp message limit reached. Add extra WhatsApp credits or upgrade the plan."
          );
        }

        await tx.tenantUsageCounter.update({
          where: { tenantId },
          data: { whatsappMessagesUsedThisMonth: { increment: 1 } }
        });

        if (allowance.shouldConsumeCredit) {
          await tx.tenantCreditBalance.update({
            where: { tenantId },
            data: { extraWhatsappMessageCredits: { decrement: 1 } }
          });
        }

        return { consumedCredit: allowance.shouldConsumeCredit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async releaseWhatsappReservation(tenantId: string, reservation: Reservation) {
    await prisma.$transaction(async (tx) => {
      await tx.tenantUsageCounter.update({
        where: { tenantId },
        data: { whatsappMessagesUsedThisMonth: { decrement: 1 } }
      });

      if (reservation.consumedCredit) {
        await tx.tenantCreditBalance.update({
          where: { tenantId },
          data: { extraWhatsappMessageCredits: { increment: 1 } }
        });
      }
    });
  }

  async recordWhatsappMessage(tenantId: string, metadata: Prisma.InputJsonValue) {
    await prisma.usageEvent.create({
      data: {
        tenantId,
        type: "WHATSAPP_MESSAGE",
        quantity: 1,
        costEstimate: 0,
        metadata
      }
    });
  }

  async addCredits(tenantId: string, actorUserId: string | null, input: AddTenantCreditsInput) {
    return prisma.$transaction(async (tx) => {
      await this.ensureUsageState(tenantId, tx);
      const field =
        input.type === "AI_REPLY" ? "extraAiReplyCredits" : "extraWhatsappMessageCredits";

      await tx.tenantCreditBalance.update({
        where: { tenantId },
        data: {
          [field]: { increment: input.quantity }
        }
      });

      const topUp = await tx.creditTopUp.create({
        data: {
          tenantId,
          type: input.type,
          quantity: input.quantity,
          actorUserId,
          reason: input.reason ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue
        }
      });

      await tx.usageEvent.create({
        data: {
          tenantId,
          type: "CREDIT_TOPUP",
          quantity: input.quantity,
          costEstimate: 0,
          metadata: {
            creditType: input.type,
            reason: input.reason ?? null,
            actorUserId
          }
        }
      });

      await tx.tenantUsageCounter.update({
        where: { tenantId },
        data:
          input.type === "AI_REPLY"
            ? { aiDisabledDueToLimit: false }
            : { whatsappDisabledDueToLimit: false }
      });

      if (input.type === "AI_REPLY") {
        await tx.tenantAiSettings.updateMany({
          where: { tenantId },
          data: { isEnabled: true }
        });
      }

      return {
        id: topUp.id,
        type: topUp.type,
        quantity: topUp.quantity,
        reason: topUp.reason,
        createdAt: topUp.createdAt.toISOString()
      };
    });
  }

  async updateLimits(tenantId: string, input: UpdateTenantLimitsInput) {
    await this.ensureUsageState(tenantId);
    const limit = await prisma.tenantUsageLimit.update({
      where: { tenantId },
      data: {
        ...(input.planName ? { planName: input.planName } : {}),
        ...(input.billingStatus ? { billingStatus: input.billingStatus } : {}),
        ...(input.aiMonthlyReplyLimit !== undefined
          ? { aiMonthlyReplyLimit: input.aiMonthlyReplyLimit }
          : {}),
        ...(input.whatsappMonthlyMessageLimit !== undefined
          ? { whatsappMonthlyMessageLimit: input.whatsappMonthlyMessageLimit }
          : {}),
        ...(input.dailyAiCostLimit !== undefined
          ? { dailyAiCostLimit: new Prisma.Decimal(input.dailyAiCostLimit) }
          : {}),
        ...(input.monthlyAiCostLimit !== undefined
          ? { monthlyAiCostLimit: new Prisma.Decimal(input.monthlyAiCostLimit) }
          : {}),
        ...(input.billingCycleStart ? { billingCycleStart: input.billingCycleStart } : {}),
        ...(input.billingCycleEnd !== undefined ? { billingCycleEnd: input.billingCycleEnd } : {})
      }
    });

    return this.getAdminTenantSummary(limit.tenantId);
  }

  async updateModel(tenantId: string, input: UpdateTenantModelInput) {
    const modelName = normalizeModelName(input.modelName);
    await this.ensureUsageState(tenantId);
    await prisma.$transaction([
      prisma.tenantUsageLimit.update({
        where: { tenantId },
        data: { currentAiModel: modelName }
      }),
      prisma.tenantAiSettings.updateMany({
        where: { tenantId },
        data: { modelName }
      })
    ]);

    return this.getAdminTenantSummary(tenantId);
  }

  async resetUsage(tenantId: string, input: ResetTenantUsageInput, actorUserId?: string | null) {
    await prisma.$transaction(async (tx) => {
      await this.ensureUsageState(tenantId, tx);
      await tx.tenantUsageCounter.update({
        where: { tenantId },
        data: {
          ...(input.resetAi
            ? {
                aiRepliesUsedThisMonth: 0,
                aiInputTokensUsed: 0,
                aiOutputTokensUsed: 0,
                aiDisabledDueToLimit: false
              }
            : {}),
          ...(input.resetWhatsapp
            ? {
                whatsappMessagesUsedThisMonth: 0,
                whatsappDisabledDueToLimit: false
              }
            : {}),
          ...(input.resetCosts
            ? {
                aiCostUsedToday: 0,
                aiCostUsedThisMonth: 0,
                dailyCostResetAt: new Date()
              }
            : {}),
          lastUsageResetAt: new Date()
        }
      });

      if (!input.keepExtraCredits) {
        await tx.tenantCreditBalance.update({
          where: { tenantId },
          data: {
            extraAiReplyCredits: 0,
            extraWhatsappMessageCredits: 0
          }
        });
      }

      await tx.tenantAiSettings.updateMany({
        where: { tenantId },
        data: { isEnabled: true }
      });

      await tx.usageEvent.create({
        data: {
          tenantId,
          type: "LIMIT_RESET",
          quantity: 1,
          metadata: {
            resetAi: input.resetAi,
            resetWhatsapp: input.resetWhatsapp,
            resetCosts: input.resetCosts,
            keepExtraCredits: input.keepExtraCredits,
            reason: input.reason ?? null,
            actorUserId: actorUserId ?? null
          }
        }
      });
    });

    return this.getAdminTenantSummary(tenantId);
  }

  async runMonthlyReset() {
    const now = new Date();
    const limits = await prisma.tenantUsageLimit.findMany({
      where: {
        deletedAt: null,
        OR: [{ billingCycleEnd: null }, { billingCycleEnd: { lte: now } }]
      },
      select: { tenantId: true, billingCycleEnd: true }
    });

    for (const limit of limits) {
      await this.resetUsage(limit.tenantId, {
        resetAi: true,
        resetWhatsapp: true,
        resetCosts: true,
        keepExtraCredits: true,
        reason: "Scheduled monthly reset"
      });
      await prisma.tenantUsageLimit.update({
        where: { tenantId: limit.tenantId },
        data: {
          billingCycleStart: now,
          billingCycleEnd: nextMonth(now)
        }
      });
    }

    logger.info({ tenantsReset: limits.length }, "Monthly usage reset completed");
    return { tenantsReset: limits.length };
  }

  async runDailyCostReset() {
    const counters = await prisma.tenantUsageCounter.findMany({
      where: { deletedAt: null },
      select: { tenantId: true, aiCostUsedToday: true }
    });

    await prisma.$transaction(
      counters.flatMap((counter) => [
        prisma.usageEvent.create({
          data: {
            tenantId: counter.tenantId,
            type: "LIMIT_RESET",
            quantity: 1,
            costEstimate: counter.aiCostUsedToday,
            metadata: {
              resetType: "DAILY_AI_COST",
              aiCostUsedToday: decimalToNumber(counter.aiCostUsedToday)
            }
          }
        }),
        prisma.tenantUsageCounter.update({
          where: { tenantId: counter.tenantId },
          data: {
            aiCostUsedToday: 0,
            dailyCostResetAt: new Date()
          }
        })
      ])
    );

    logger.info({ tenantsReset: counters.length }, "Daily AI cost reset completed");
    return { tenantsReset: counters.length };
  }

  private async disableAiForLimit(tenantId: string, tx: Tx, reason: string) {
    await tx.tenantUsageCounter.update({
      where: { tenantId },
      data: { aiDisabledDueToLimit: true }
    });
    await tx.tenantAiSettings.updateMany({
      where: { tenantId },
      data: { isEnabled: false }
    });
    await this.createUsageNotification(
      tenantId,
      "AI usage limit reached",
      "AI replies have been disabled for this tenant. Add credits, update limits, or wait for reset.",
      { type: "AI_LIMIT_REACHED", reason },
      tx
    );
  }

  private async notifyCostWarnings(
    tenantId: string,
    counter: Prisma.TenantUsageCounterGetPayload<Record<string, never>>
  ) {
    const { limit } = await this.ensureUsageState(tenantId);
    const daily = warningThresholdsCrossed(
      usageRatio(decimalToNumber(counter.aiCostUsedToday), decimalToNumber(limit.dailyAiCostLimit))
    );
    const monthly = warningThresholdsCrossed(
      usageRatio(decimalToNumber(counter.aiCostUsedThisMonth), decimalToNumber(limit.monthlyAiCostLimit))
    );

    if (daily.hundred || monthly.hundred) {
      await this.createUsageNotification(tenantId, "AI cost limit reached", "AI has reached a configured cost limit.", {
        type: "AI_COST_LIMIT_REACHED",
        daily,
        monthly
      });
      return;
    }

    if (daily.ninety || monthly.ninety || daily.eighty || monthly.eighty) {
      await this.createUsageNotification(tenantId, "AI cost usage warning", "AI usage is approaching a configured cost limit.", {
        type: "AI_COST_WARNING",
        daily,
        monthly
      });
    }
  }

  private async createUsageNotification(
    tenantId: string,
    title: string,
    body: string,
    metadata: Prisma.InputJsonValue,
    tx: Tx = prisma
  ) {
    const members = await tx.tenantMember.findMany({
      where: {
        tenantId,
        role: { in: ["OWNER", "ADMIN"] },
        status: "ACTIVE",
        deletedAt: null
      },
      select: { userId: true }
    });

    if (members.length === 0) {
      await tx.notification.create({
        data: { tenantId, title, body, metadata }
      });
      return;
    }

    await tx.notification.createMany({
      data: members.map((member) => ({
        tenantId,
        userId: member.userId,
        title,
        body,
        metadata
      }))
    });
  }
}

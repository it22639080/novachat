import {
  MessageDirection,
  MessageSenderType,
  MessageStatus,
  MessageType,
  PrismaClient,
  Role
} from "@prisma/client";
import { loadDatabaseEnv } from "./load-env";

loadDatabaseEnv();

const prisma = new PrismaClient();

const now = new Date();
const nextMonth = new Date(now);
nextMonth.setMonth(nextMonth.getMonth() + 1);
const trialEnd = new Date(now);
trialEnd.setDate(trialEnd.getDate() + 14);
const usagePeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const usagePeriodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

const seedPasswordHash = "$2a$12$mwSJTCBE2jlTH/ewiOAFGO8EVwBHVx3lXavlxma.8yNX/28EVglPy";
const seedCurrency = "USD" as const;

function planLimits(input: {
  seats: number;
  monthlyMessages: number;
  aiResponses: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  whatsappAccounts: number;
  storageMb: number;
}) {
  return {
    seats: input.seats,
    monthlyMessages: input.monthlyMessages,
    aiResponses: input.aiResponses,
    aiInputTokens: input.aiInputTokens,
    aiOutputTokens: input.aiOutputTokens,
    whatsappAccounts: input.whatsappAccounts,
    storageMb: input.storageMb,
    knowledgeBaseStorageLimitBytes: input.storageMb * 1024 * 1024
  };
}

async function main() {
  const permissions = [
    ["tenant.manage", "Manage tenant"],
    ["members.manage", "Manage members"],
    ["conversations.read", "Read conversations"],
    ["conversations.reply", "Reply to conversations"],
    ["crm.manage", "Manage CRM"],
    ["commerce.manage", "Manage commerce"],
    ["campaigns.manage", "Manage campaigns"],
    ["ai.manage", "Manage AI"]
  ] as const;

  await Promise.all(
    permissions.map(async ([key, name]) => {
      const permission = await prisma.permission.upsert({
        where: { key },
        update: { name },
        create: { key, name }
      });

      await Promise.all(
        [Role.OWNER, Role.ADMIN].map((role) =>
          prisma.rolePermission.upsert({
            where: {
              role_permissionId: {
                role,
                permissionId: permission.id
              }
            },
            update: {},
            create: {
              role,
              permissionId: permission.id
            }
          })
        )
      );
    })
  );

  const starterPlan = await prisma.plan.upsert({
    where: { code: "starter" },
    update: {
      name: "Starter",
      description: "Starter plan for small teams validating WhatsApp AI automation.",
      priceMonthly: "29.00",
      monthlyPrice: "29.00",
      yearlyPrice: "290.00",
      currency: seedCurrency,
      aiReplyLimit: 1000,
      aiInputTokenLimit: 500000,
      aiOutputTokenLimit: 250000,
      whatsappMessageLimit: 3000,
      agentLimit: 3,
      whatsappAccountLimit: 1,
      knowledgeBaseStorageLimitBytes: BigInt(1024 * 1024 * 1024),
      featuresJson: {
        inbox: true,
        aiAssistant: true,
        knowledgeBase: true,
        basicAnalytics: true
      },
      isActive: true,
      archivedAt: null,
      limits: planLimits({
        seats: 3,
        monthlyMessages: 3000,
        aiResponses: 1000,
        aiInputTokens: 500000,
        aiOutputTokens: 250000,
        whatsappAccounts: 1,
        storageMb: 1024
      })
    },
    create: {
      code: "starter",
      name: "Starter",
      description: "Starter plan for small teams validating WhatsApp AI automation.",
      priceMonthly: "29.00",
      monthlyPrice: "29.00",
      yearlyPrice: "290.00",
      currency: seedCurrency,
      aiReplyLimit: 1000,
      aiInputTokenLimit: 500000,
      aiOutputTokenLimit: 250000,
      whatsappMessageLimit: 3000,
      agentLimit: 3,
      whatsappAccountLimit: 1,
      knowledgeBaseStorageLimitBytes: BigInt(1024 * 1024 * 1024),
      featuresJson: {
        inbox: true,
        aiAssistant: true,
        knowledgeBase: true,
        basicAnalytics: true
      },
      isActive: true,
      limits: planLimits({
        seats: 3,
        monthlyMessages: 3000,
        aiResponses: 1000,
        aiInputTokens: 500000,
        aiOutputTokens: 250000,
        whatsappAccounts: 1,
        storageMb: 1024
      })
    }
  });

  await prisma.plan.upsert({
    where: { code: "business" },
    update: {
      name: "Business",
      description: "Business plan for growing sales and support teams.",
      priceMonthly: "99.00",
      monthlyPrice: "99.00",
      yearlyPrice: "990.00",
      currency: seedCurrency,
      aiReplyLimit: 10000,
      aiInputTokenLimit: 5000000,
      aiOutputTokenLimit: 2500000,
      whatsappMessageLimit: 25000,
      agentLimit: 10,
      whatsappAccountLimit: 3,
      knowledgeBaseStorageLimitBytes: BigInt(10 * 1024 * 1024 * 1024),
      featuresJson: {
        inbox: true,
        aiAssistant: true,
        knowledgeBase: true,
        campaigns: true,
        advancedAnalytics: true
      },
      isActive: true,
      archivedAt: null,
      limits: planLimits({
        seats: 10,
        monthlyMessages: 25000,
        aiResponses: 10000,
        aiInputTokens: 5000000,
        aiOutputTokens: 2500000,
        whatsappAccounts: 3,
        storageMb: 10240
      })
    },
    create: {
      code: "business",
      name: "Business",
      description: "Business plan for growing sales and support teams.",
      priceMonthly: "99.00",
      monthlyPrice: "99.00",
      yearlyPrice: "990.00",
      currency: seedCurrency,
      aiReplyLimit: 10000,
      aiInputTokenLimit: 5000000,
      aiOutputTokenLimit: 2500000,
      whatsappMessageLimit: 25000,
      agentLimit: 10,
      whatsappAccountLimit: 3,
      knowledgeBaseStorageLimitBytes: BigInt(10 * 1024 * 1024 * 1024),
      featuresJson: {
        inbox: true,
        aiAssistant: true,
        knowledgeBase: true,
        campaigns: true,
        advancedAnalytics: true
      },
      isActive: true,
      limits: planLimits({
        seats: 10,
        monthlyMessages: 25000,
        aiResponses: 10000,
        aiInputTokens: 5000000,
        aiOutputTokens: 2500000,
        whatsappAccounts: 3,
        storageMb: 10240
      })
    }
  });

  const plan = await prisma.plan.upsert({
    where: { code: "growth" },
    update: {
      name: "Growth",
      priceMonthly: "99.00",
      monthlyPrice: "99.00",
      yearlyPrice: "990.00",
      aiReplyLimit: 10000,
      aiInputTokenLimit: 5000000,
      aiOutputTokenLimit: 2500000,
      whatsappMessageLimit: 25000,
      agentLimit: 10,
      whatsappAccountLimit: 3,
      knowledgeBaseStorageLimitBytes: BigInt(10 * 1024 * 1024 * 1024),
      featuresJson: {
        inbox: true,
        aiAssistant: true,
        knowledgeBase: true,
        campaigns: true,
        advancedAnalytics: true
      },
      limits: {
        seats: 10,
        monthlyMessages: 25000,
        aiResponses: 10000,
        aiInputTokens: 5000000,
        aiOutputTokens: 2500000,
        whatsappAccounts: 3,
        storageMb: 10240
      }
    },
    create: {
      code: "growth",
      name: "Growth",
      description: "Demo subscription plan for growing WhatsApp-first businesses.",
      priceMonthly: "99.00",
      monthlyPrice: "99.00",
      yearlyPrice: "990.00",
      currency: seedCurrency,
      aiReplyLimit: 10000,
      aiInputTokenLimit: 5000000,
      aiOutputTokenLimit: 2500000,
      whatsappMessageLimit: 25000,
      agentLimit: 10,
      whatsappAccountLimit: 3,
      knowledgeBaseStorageLimitBytes: BigInt(10 * 1024 * 1024 * 1024),
      featuresJson: {
        inbox: true,
        aiAssistant: true,
        knowledgeBase: true,
        campaigns: true,
        advancedAnalytics: true
      },
      limits: {
        seats: 10,
        monthlyMessages: 25000,
        aiResponses: 10000,
        aiInputTokens: 5000000,
        aiOutputTokens: 2500000,
        whatsappAccounts: 3,
        storageMb: 10240
      }
    }
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@novachat.ai" },
    update: {
      name: "NovaChat Super Admin",
      isSuperAdmin: true,
      passwordHash: seedPasswordHash,
      emailVerifiedAt: now
    },
    create: {
      email: "superadmin@novachat.ai",
      name: "NovaChat Super Admin",
      passwordHash: seedPasswordHash,
      isSuperAdmin: true,
      emailVerifiedAt: now
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "abc-fashion" },
    update: {
      name: "ABC Fashion",
      status: "APPROVED",
      timezone: "Asia/Colombo",
      approvedAt: now,
      approvedBy: superAdmin.id,
      rejectedAt: null,
      rejectionReason: null,
      suspendedAt: null,
      approvalStatusChangedAt: now
    },
    create: {
      name: "ABC Fashion",
      slug: "abc-fashion",
      status: "APPROVED",
      timezone: "Asia/Colombo",
      approvedAt: now,
      approvedBy: superAdmin.id,
      approvalStatusChangedAt: now
    }
  });

  const teamSeeds: Array<{ email: string; name: string; role: Role }> = [
    { email: "owner@abcfashion.test", name: "Ayesha Fernando", role: Role.OWNER },
    { email: "manager@abcfashion.test", name: "Nimal Perera", role: Role.MANAGER },
    { email: "agent@abcfashion.test", name: "Kavindi Silva", role: Role.AGENT }
  ];

  const teamUsers = await Promise.all(
    teamSeeds.map(async ({ email, name, role }) => {
      const user = await prisma.user.upsert({
        where: { email },
        update: { name, passwordHash: seedPasswordHash, emailVerifiedAt: now },
        create: {
          email,
          name,
          passwordHash: seedPasswordHash,
          emailVerifiedAt: now
        }
      });

      await prisma.tenantMember.upsert({
        where: {
          tenantId_userId: {
            tenantId: tenant.id,
            userId: user.id
          }
        },
        update: {
          role,
          status: "ACTIVE"
        },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          role,
          status: "ACTIVE"
        }
      });

      return user;
    })
  );

  const agent = teamUsers[2];

  if (!agent) {
    throw new Error("Seed agent user was not created");
  }

  const pendingOwner = await prisma.user.upsert({
    where: { email: "pending@novachat.ai" },
    update: {
      name: "Pending Business Owner",
      passwordHash: seedPasswordHash,
      emailVerifiedAt: now
    },
    create: {
      email: "pending@novachat.ai",
      name: "Pending Business Owner",
      passwordHash: seedPasswordHash,
      emailVerifiedAt: now
    }
  });

  const pendingTenant = await prisma.tenant.upsert({
    where: { slug: "pending-review" },
    update: {
      name: "Pending Review Co",
      status: "PENDING_ADMIN_APPROVAL",
      timezone: "Asia/Colombo",
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      suspendedAt: null,
      approvalStatusChangedAt: now
    },
    create: {
      name: "Pending Review Co",
      slug: "pending-review",
      status: "PENDING_ADMIN_APPROVAL",
      timezone: "Asia/Colombo",
      approvalStatusChangedAt: now
    }
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: pendingTenant.id,
        userId: pendingOwner.id
      }
    },
    update: {
      role: Role.OWNER,
      status: "ACTIVE"
    },
    create: {
      tenantId: pendingTenant.id,
      userId: pendingOwner.id,
      role: Role.OWNER,
      status: "ACTIVE"
    }
  });

  await prisma.notification.upsert({
    where: { id: "seed-pending-review-notification-1" },
    update: {
      tenantId: pendingTenant.id,
      userId: pendingOwner.id,
      title: "Account awaiting admin approval",
      body: "Your NovaChat AI workspace has been verified and is waiting for platform admin approval.",
      metadata: {
        type: "ACCOUNT_PENDING_ADMIN_APPROVAL",
        tenantId: pendingTenant.id
      }
    },
    create: {
      id: "seed-pending-review-notification-1",
      tenantId: pendingTenant.id,
      userId: pendingOwner.id,
      title: "Account awaiting admin approval",
      body: "Your NovaChat AI workspace has been verified and is waiting for platform admin approval.",
      metadata: {
        type: "ACCOUNT_PENDING_ADMIN_APPROVAL",
        tenantId: pendingTenant.id
      }
    }
  });

  await prisma.auditLog.upsert({
    where: { id: "seed-pending-review-audit-1" },
    update: {
      actorUserId: pendingOwner.id,
      action: "auth.email_verified",
      entityType: "Tenant",
      entityId: pendingTenant.id,
      metadata: {
        status: "PENDING_ADMIN_APPROVAL"
      }
    },
    create: {
      id: "seed-pending-review-audit-1",
      tenantId: pendingTenant.id,
      actorUserId: pendingOwner.id,
      action: "auth.email_verified",
      entityType: "Tenant",
      entityId: pendingTenant.id,
      metadata: {
        status: "PENDING_ADMIN_APPROVAL"
      }
    }
  });

  await prisma.subscription.upsert({
    where: { id: "seed-abc-fashion-subscription" },
    update: {
      tenantId: tenant.id,
      planId: plan.id,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      startAt: now,
      endAt: nextMonth,
      autoRenew: true,
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth
    },
    create: {
      id: "seed-abc-fashion-subscription",
      tenantId: tenant.id,
      planId: plan.id,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      startAt: now,
      endAt: nextMonth,
      autoRenew: true,
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth
    }
  });

  await prisma.subscription.upsert({
    where: { id: "seed-pending-review-subscription" },
    update: {
      tenantId: pendingTenant.id,
      planId: starterPlan.id,
      status: "TRIAL",
      billingCycle: "MONTHLY",
      startAt: now,
      trialEndAt: trialEnd,
      trialEndsAt: trialEnd,
      endAt: trialEnd,
      autoRenew: false,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd
    },
    create: {
      id: "seed-pending-review-subscription",
      tenantId: pendingTenant.id,
      planId: starterPlan.id,
      status: "TRIAL",
      billingCycle: "MONTHLY",
      startAt: now,
      trialEndAt: trialEnd,
      trialEndsAt: trialEnd,
      endAt: trialEnd,
      autoRenew: false,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd
    }
  });

  await prisma.tenantUsageLimit.upsert({
    where: { tenantId: tenant.id },
    update: {
      planName: "Growth",
      billingStatus: "ACTIVE",
      aiMonthlyReplyLimit: 10000,
      whatsappMonthlyMessageLimit: 25000,
      currentAiModel: "gpt-4o-mini",
      dailyAiCostLimit: "10",
      monthlyAiCostLimit: "200",
      billingCycleStart: now,
      billingCycleEnd: nextMonth
    },
    create: {
      tenantId: tenant.id,
      planName: "Growth",
      billingStatus: "ACTIVE",
      aiMonthlyReplyLimit: 10000,
      whatsappMonthlyMessageLimit: 25000,
      currentAiModel: "gpt-4o-mini",
      dailyAiCostLimit: "10",
      monthlyAiCostLimit: "200",
      billingCycleStart: now,
      billingCycleEnd: nextMonth
    }
  });

  await prisma.tenantUsageLimit.upsert({
    where: { tenantId: pendingTenant.id },
    update: {
      planName: "Starter",
      billingStatus: "TRIALING",
      aiMonthlyReplyLimit: 1000,
      whatsappMonthlyMessageLimit: 3000,
      currentAiModel: "gpt-4o-mini",
      dailyAiCostLimit: "2",
      monthlyAiCostLimit: "30",
      billingCycleStart: now,
      billingCycleEnd: trialEnd
    },
    create: {
      tenantId: pendingTenant.id,
      planName: "Starter",
      billingStatus: "TRIALING",
      aiMonthlyReplyLimit: 1000,
      whatsappMonthlyMessageLimit: 3000,
      currentAiModel: "gpt-4o-mini",
      dailyAiCostLimit: "2",
      monthlyAiCostLimit: "30",
      billingCycleStart: now,
      billingCycleEnd: trialEnd
    }
  });

  await Promise.all(
    [tenant.id, pendingTenant.id].map((tenantId) =>
      prisma.tenantUsageCounter.upsert({
        where: { tenantId },
        update: {
          aiDisabledDueToLimit: false,
          whatsappDisabledDueToLimit: false,
          lastUsageResetAt: now,
          dailyCostResetAt: now
        },
        create: {
          tenantId,
          aiDisabledDueToLimit: false,
          whatsappDisabledDueToLimit: false,
          lastUsageResetAt: now,
          dailyCostResetAt: now
        }
      })
    )
  );

  await Promise.all(
    [tenant.id, pendingTenant.id].map((tenantId) =>
      prisma.tenantCreditBalance.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId }
      })
    )
  );

  await Promise.all(
    [tenant.id, pendingTenant.id].map((tenantId) =>
      prisma.monthlyUsage.upsert({
        where: {
          tenantId_periodStart_periodEnd: {
            tenantId,
            periodStart: usagePeriodStart,
            periodEnd: usagePeriodEnd
          }
        },
        update: {},
        create: {
          tenantId,
          periodStart: usagePeriodStart,
          periodEnd: usagePeriodEnd
        }
      })
    )
  );

  const stageSeeds: Array<{ name: string; color: string; position: number; isDefault: boolean }> = [
    { name: "New", color: "#60a5fa", position: 1, isDefault: true },
    { name: "Qualified", color: "#34d399", position: 2, isDefault: false },
    { name: "Won", color: "#22c55e", position: 3, isDefault: false },
    { name: "Lost", color: "#f87171", position: 4, isDefault: false }
  ];

  const stages = await Promise.all(
    stageSeeds.map(({ name, color, position, isDefault }) =>
      prisma.leadStage.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name
          }
        },
        update: {
          color,
          position,
          isDefault
        },
        create: {
          tenantId: tenant.id,
          name,
          color,
          position,
          isDefault
        }
      })
    )
  );

  const customerSeeds: Array<{ name: string; email: string; phone: string }> = [
    { name: "Dilani Jayawardena", email: "dilani@example.com", phone: "+94771110001" },
    { name: "Maya Wickramasinghe", email: "maya@example.com", phone: "+94771110002" },
    { name: "Sasha Perera", email: "sasha@example.com", phone: "+94771110003" }
  ];

  const customers = await Promise.all(
    customerSeeds.map(({ name, email, phone }) =>
      prisma.customer.upsert({
        where: {
          tenantId_phone: {
            tenantId: tenant.id,
            phone
          }
        },
        update: { name, email, status: "ACTIVE" },
        create: {
          tenantId: tenant.id,
          name,
          email,
          phone,
          status: "ACTIVE"
        }
      })
    )
  );

  const category = await prisma.productCategory.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: "summer-collection"
      }
    },
    update: { name: "Summer Collection" },
    create: {
      tenantId: tenant.id,
      name: "Summer Collection",
      slug: "summer-collection"
    }
  });

  const productSeeds: Array<{ sku: string; name: string; price: string }> = [
    { sku: "ABC-DRS-001", name: "Linen Wrap Dress", price: "79.00" },
    { sku: "ABC-BAG-002", name: "Canvas Weekend Bag", price: "49.00" },
    { sku: "ABC-SND-003", name: "Minimal Leather Sandals", price: "59.00" }
  ];

  await Promise.all(
    productSeeds.map(({ sku, name, price }) =>
      prisma.product.upsert({
        where: {
          tenantId_sku: {
            tenantId: tenant.id,
            sku
          }
        },
        update: {
          name,
          price,
          categoryId: category.id,
          isActive: true
        },
        create: {
          tenantId: tenant.id,
          categoryId: category.id,
          sku,
          name,
          price,
          currency: seedCurrency,
          isActive: true
        }
      })
    )
  );

  const conversation = await prisma.conversation.upsert({
    where: { id: "seed-abc-fashion-conversation-1" },
    update: {
      assignedUserId: agent.id,
      status: "OPEN",
      priority: "NORMAL",
      subject: "Dress size inquiry",
      lastMessageAt: now
    },
    create: {
      id: "seed-abc-fashion-conversation-1",
      tenantId: tenant.id,
      customerId: customers[0]!.id,
      assignedUserId: agent.id,
      status: "OPEN",
      priority: "NORMAL",
      subject: "Dress size inquiry",
      lastMessageAt: now
    }
  });

  await Promise.all(
    [
      {
        id: "seed-abc-fashion-message-1",
        tenantId: tenant.id,
        conversationId: conversation.id,
        customerId: customers[0]!.id,
        direction: MessageDirection.INBOUND,
        senderType: MessageSenderType.CUSTOMER,
        type: MessageType.TEXT,
        status: MessageStatus.RECEIVED,
        text: "Hi, is the linen wrap dress available in medium?"
      },
      {
        id: "seed-abc-fashion-message-2",
        tenantId: tenant.id,
        conversationId: conversation.id,
        customerId: customers[0]!.id,
        direction: MessageDirection.OUTBOUND,
        senderType: MessageSenderType.USER,
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        text: "Yes, medium is available. Would you like us to reserve one?"
      }
    ].map((message) =>
      prisma.message.upsert({
        where: { id: message.id },
        update: message,
        create: message
      })
    )
  );

  await prisma.lead.upsert({
    where: { id: "seed-abc-fashion-lead-1" },
    update: {
      customerId: customers[0]!.id,
      stageId: stages[1]!.id,
      title: "Linen dress purchase inquiry",
      status: "OPEN",
      source: "WhatsApp",
      value: "79.00",
      currency: seedCurrency,
      score: 70
    },
    create: {
      id: "seed-abc-fashion-lead-1",
      tenantId: tenant.id,
      customerId: customers[0]!.id,
      stageId: stages[1]!.id,
      title: "Linen dress purchase inquiry",
      status: "OPEN",
      source: "WhatsApp",
      value: "79.00",
      currency: seedCurrency,
      score: 70
    }
  });

  await prisma.auditLog.upsert({
    where: { id: "seed-abc-fashion-audit-1" },
    update: {
      actorUserId: superAdmin.id,
      action: "seed.completed",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: {
        tenant: tenant.slug
      }
    },
    create: {
      id: "seed-abc-fashion-audit-1",
      tenantId: tenant.id,
      actorUserId: superAdmin.id,
      action: "seed.completed",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: {
        tenant: tenant.slug
      }
    }
  });

  console.log("Seed completed for NovaChat AI demo tenant: ABC Fashion");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import {
  Currency,
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

  const plan = await prisma.plan.upsert({
    where: { code: "growth" },
    update: {
      name: "Growth",
      priceMonthly: "99.00",
      limits: {
        seats: 10,
        monthlyMessages: 25000,
        aiResponses: 10000,
        storageMb: 10240
      }
    },
    create: {
      code: "growth",
      name: "Growth",
      description: "Demo subscription plan for growing WhatsApp-first businesses.",
      priceMonthly: "99.00",
      currency: Currency.USD,
      limits: {
        seats: 10,
        monthlyMessages: 25000,
        aiResponses: 10000,
        storageMb: 10240
      }
    }
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@novachat.ai" },
    update: {
      name: "NovaChat Super Admin",
      isSuperAdmin: true
    },
    create: {
      email: "superadmin@novachat.ai",
      name: "NovaChat Super Admin",
      isSuperAdmin: true,
      emailVerifiedAt: now
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "abc-fashion" },
    update: {
      name: "ABC Fashion",
      status: "ACTIVE",
      timezone: "Asia/Colombo"
    },
    create: {
      name: "ABC Fashion",
      slug: "abc-fashion",
      status: "ACTIVE",
      timezone: "Asia/Colombo"
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
        update: { name },
        create: {
          email,
          name,
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

  await prisma.subscription.upsert({
    where: { id: "seed-abc-fashion-subscription" },
    update: {
      tenantId: tenant.id,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth
    },
    create: {
      id: "seed-abc-fashion-subscription",
      tenantId: tenant.id,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth
    }
  });

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
          currency: Currency.USD,
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
      currency: Currency.USD,
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
      currency: Currency.USD,
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

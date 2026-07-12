import { Prisma, prisma } from "@novachat/database";
import type {
  CustomerImportInput,
  CustomerInput,
  CustomerNoteInput,
  CustomerTagInput,
  CustomerUpdateInput,
  CustomersQuery,
  LeadInput,
  LeadOutcomeInput,
  LeadStageInput,
  LeadStageMoveInput,
  LeadUpdateInput,
  LeadsQuery
} from "@novachat/shared-types";
import { conflict, notFound } from "../../shared/errors/app-error.js";
import { createPagination } from "../../shared/pagination/create-pagination.js";

type Actor = {
  userId: string;
};

function normalizePhone(phone: string) {
  return phone.trim().replace(/[^\d+]/g, "");
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsv(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0] ?? "").map((header) => header.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function mapTagLink(item: { tag: { id: string; name: string; color: string | null } }) {
  return item.tag;
}

function mapCustomer(customer: CustomerRecord) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    whatsappWaId: customer.whatsappWaId,
    status: customer.status,
    customFields: customer.customFields,
    tags: customer.tags.map(mapTagLink),
    counts: customer._count,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString()
  };
}

function mapLead(lead: LeadRecord) {
  return {
    id: lead.id,
    title: lead.title,
    status: lead.status,
    source: lead.source,
    value: lead.value ? Number(lead.value) : null,
    currency: lead.currency,
    score: lead.score,
    expectedCloseDate: serializeDate(lead.expectedCloseDate),
    followUpAt: serializeDate(lead.followUpAt),
    followUpNote: lead.followUpNote,
    aiScoreMetadata: lead.aiScoreMetadata,
    aiNextAction: lead.aiNextAction,
    customer: {
      id: lead.customer.id,
      name: lead.customer.name,
      email: lead.customer.email,
      phone: lead.customer.phone
    },
    stage: lead.stage,
    assignedUser: lead.assignedUser,
    noteCount: lead._count.notes,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString()
  };
}

type CustomerRecord = Prisma.CustomerGetPayload<{
  include: ReturnType<typeof customerInclude>;
}>;

type LeadRecord = Prisma.LeadGetPayload<{
  include: ReturnType<typeof leadInclude>;
}>;

export class CrmService {
  async listCustomers(tenantId: string, query: CustomersQuery) {
    const pagination = createPagination(query);
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: query.createdFrom } : {}),
              ...(query.createdTo ? { lte: query.createdTo } : {})
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
              { phone: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        include: customerInclude(),
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.customer.count({ where })
    ]);

    return {
      items: items.map(mapCustomer),
      pagination: pagination.meta(total)
    };
  }

  async createCustomer(tenantId: string, input: CustomerInput) {
    const customer = await prisma.customer.upsert({
      where: {
        tenantId_phone: {
          tenantId,
          phone: normalizePhone(input.phone)
        }
      },
      update: {
        name: input.name ?? null,
        email: input.email ?? null,
        status: input.status,
        ...(input.customFields ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
        deletedAt: null
      },
      create: {
        tenantId,
        phone: normalizePhone(input.phone),
        name: input.name ?? null,
        email: input.email ?? null,
        status: input.status,
        ...(input.customFields ? { customFields: input.customFields as Prisma.InputJsonValue } : {})
      },
      include: customerInclude()
    });

    return mapCustomer(customer);
  }

  async updateCustomer(tenantId: string, customerId: string, input: CustomerUpdateInput) {
    await this.getCustomerOrThrow(tenantId, customerId);
    const phone = input.phone ? normalizePhone(input.phone) : undefined;

    if (phone) {
      const existing = await prisma.customer.findFirst({
        where: {
          tenantId,
          phone,
          id: { not: customerId },
          deletedAt: null
        }
      });

      if (existing) {
        throw conflict("Another customer already uses this phone number");
      }
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(input.name !== undefined ? { name: input.name ?? null } : {}),
        ...(input.email !== undefined ? { email: input.email ?? null } : {}),
        ...(phone ? { phone } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.customFields ? { customFields: input.customFields as Prisma.InputJsonValue } : {})
      },
      include: customerInclude()
    });

    return mapCustomer(customer);
  }

  async deleteCustomer(tenantId: string, customerId: string) {
    await this.getCustomerOrThrow(tenantId, customerId);
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        status: "ARCHIVED",
        deletedAt: new Date()
      }
    });

    return { deleted: true };
  }

  async getCustomerProfile(tenantId: string, customerId: string) {
    const customer = await this.getCustomerOrThrow(tenantId, customerId);
    const [timeline, notes, conversations, leads] = await prisma.$transaction([
      prisma.message.findMany({
        where: { tenantId, customerId, deletedAt: null },
        select: {
          id: true,
          direction: true,
          senderType: true,
          text: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        take: 30
      }),
      prisma.note.findMany({
        where: { tenantId, customerId, deletedAt: null },
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.conversation.findMany({
        where: { tenantId, customerId, deletedAt: null },
        select: {
          id: true,
          status: true,
          subject: true,
          lastMessageAt: true,
          createdAt: true
        },
        orderBy: { lastMessageAt: "desc" }
      }),
      prisma.lead.findMany({
        where: { tenantId, customerId, deletedAt: null },
        include: leadInclude(),
        orderBy: { createdAt: "desc" }
      })
    ]);

    return {
      customer: mapCustomer(customer),
      timeline: timeline.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString()
      })),
      notes: notes.map((note) => ({
        id: note.id,
        body: note.body,
        author: note.author,
        createdAt: note.createdAt.toISOString()
      })),
      conversations: conversations.map((conversation) => ({
        ...conversation,
        lastMessageAt: serializeDate(conversation.lastMessageAt),
        createdAt: conversation.createdAt.toISOString()
      })),
      leads: leads.map(mapLead)
    };
  }

  async createCustomerNote(tenantId: string, actor: Actor, customerId: string, input: CustomerNoteInput) {
    await this.getCustomerOrThrow(tenantId, customerId);
    const note = await prisma.note.create({
      data: {
        tenantId,
        customerId,
        authorUserId: actor.userId,
        body: input.body
      },
      include: { author: { select: { id: true, name: true, email: true } } }
    });

    return {
      id: note.id,
      body: note.body,
      author: note.author,
      createdAt: note.createdAt.toISOString()
    };
  }

  async addCustomerTag(tenantId: string, customerId: string, input: CustomerTagInput) {
    await this.getCustomerOrThrow(tenantId, customerId);
    const tag = await this.resolveTag(tenantId, input);

    await prisma.customerTag.upsert({
      where: {
        customerId_tagId: {
          customerId,
          tagId: tag.id
        }
      },
      update: {},
      create: {
        customerId,
        tagId: tag.id
      }
    });

    return { tag };
  }

  async removeCustomerTag(tenantId: string, customerId: string, tagId: string) {
    await this.getCustomerOrThrow(tenantId, customerId);
    await prisma.customerTag.deleteMany({
      where: {
        customerId,
        tagId,
        tag: { tenantId }
      }
    });
    return { removed: true };
  }

  async importCustomers(tenantId: string, input: CustomerImportInput) {
    const rows = parseCsv(input.csv);
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const [index, row] of rows.entries()) {
        const phone = normalizePhone(row.phone ?? "");

        if (!phone) {
          skipped += 1;
          errors.push({ row: index + 2, message: "Phone is required" });
          continue;
        }

        const data = {
          tenantId,
          phone,
          name: row.name || null,
          email: row.email || null,
          status: "ACTIVE" as const,
          customFields: {
            importSource: "csv",
            company: row.company || null
          }
        };

        if (input.updateExisting) {
          await tx.customer.upsert({
            where: { tenantId_phone: { tenantId, phone } },
            update: {
              name: data.name,
              email: data.email,
              customFields: data.customFields,
              deletedAt: null,
              status: "ACTIVE"
            },
            create: data
          });
        } else {
          const exists = await tx.customer.findUnique({
            where: { tenantId_phone: { tenantId, phone } }
          });

          if (exists) {
            skipped += 1;
            continue;
          }

          await tx.customer.create({ data });
        }

        imported += 1;
      }
    });

    return {
      imported,
      skipped,
      errors
    };
  }

  async exportCustomersCsv(tenantId: string) {
    const customers = await prisma.customer.findMany({
      where: { tenantId, deletedAt: null },
      include: customerInclude(),
      orderBy: { createdAt: "desc" }
    });
    const header = ["id", "name", "email", "phone", "status", "tags", "createdAt"];
    const rows = customers.map((customer) => [
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
      customer.status,
      customer.tags.map((item) => item.tag.name).join("|"),
      customer.createdAt.toISOString()
    ]);

    return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  async listLeads(tenantId: string, actor: Actor, query: LeadsQuery) {
    const pagination = createPagination(query);
    const where = leadWhere(tenantId, actor.userId, query);
    const [items, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        include: leadInclude(),
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.lead.count({ where })
    ]);

    return {
      items: items.map(mapLead),
      pagination: pagination.meta(total)
    };
  }

  async kanban(tenantId: string) {
    const stages = await prisma.leadStage.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        leads: {
          where: { tenantId, status: "OPEN", deletedAt: null },
          include: leadInclude(),
          orderBy: [{ score: "desc" }, { createdAt: "desc" }]
        }
      },
      orderBy: { position: "asc" }
    });

    return stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      position: stage.position,
      isDefault: stage.isDefault,
      leads: stage.leads.map(mapLead)
    }));
  }

  async createLead(tenantId: string, actor: Actor, input: LeadInput) {
    const lead = await prisma.$transaction(async (tx) => {
      const customerId =
        input.customerId ??
        (await this.createCustomerForLead(tx, tenantId, input.customer)).id;
      const stageId = input.stageId ?? (await this.defaultStage(tx, tenantId)).id;

      await this.assertCustomer(tx, tenantId, customerId);
      await this.assertStage(tx, tenantId, stageId);

      if (input.assignedUserId) {
        await this.assertAssignee(tx, tenantId, input.assignedUserId);
      }

      return tx.lead.create({
        data: {
          tenantId,
          customerId,
          stageId,
          assignedUserId: input.assignedUserId ?? null,
          title: input.title,
          status: input.status,
          source: input.source ?? null,
          value: input.value !== undefined ? new Prisma.Decimal(input.value) : null,
          currency: input.currency,
          score: input.score,
          expectedCloseDate: input.expectedCloseDate ?? null,
          followUpAt: input.followUpAt ?? null,
          followUpNote: input.followUpNote ?? null,
          aiScoreMetadata:
            (input.aiScoreMetadata as Prisma.InputJsonValue | undefined) ??
            ({
              placeholder: true,
              message: "AI lead scoring will be calculated in the AI automation phase."
            } as Prisma.InputJsonValue),
          aiNextAction:
            input.aiNextAction ??
            "AI follow-up suggestions will appear after the AI automation phase."
        },
        include: leadInclude()
      });
    });

    return mapLead(lead);
  }

  async updateLead(tenantId: string, actor: Actor, leadId: string, input: LeadUpdateInput) {
    await this.getLeadOrThrow(tenantId, leadId);

    if (input.customerId) {
      await this.assertCustomer(prisma, tenantId, input.customerId);
    }

    if (input.stageId) {
      await this.assertStage(prisma, tenantId, input.stageId);
    }

    if (input.assignedUserId) {
      await this.assertAssignee(prisma, tenantId, input.assignedUserId);
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.stageId ? { stageId: input.stageId } : {}),
        ...(input.assignedUserId !== undefined ? { assignedUserId: input.assignedUserId } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.source !== undefined ? { source: input.source ?? null } : {}),
        ...(input.value !== undefined ? { value: new Prisma.Decimal(input.value) } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.score !== undefined ? { score: input.score } : {}),
        ...(input.expectedCloseDate !== undefined ? { expectedCloseDate: input.expectedCloseDate ?? null } : {}),
        ...(input.followUpAt !== undefined ? { followUpAt: input.followUpAt ?? null } : {}),
        ...(input.followUpNote !== undefined ? { followUpNote: input.followUpNote ?? null } : {}),
        ...(input.aiScoreMetadata
          ? { aiScoreMetadata: input.aiScoreMetadata as Prisma.InputJsonValue }
          : {}),
        ...(input.aiNextAction !== undefined ? { aiNextAction: input.aiNextAction ?? null } : {})
      },
      include: leadInclude()
    });

    return mapLead(lead);
  }

  async deleteLead(tenantId: string, leadId: string) {
    await this.getLeadOrThrow(tenantId, leadId);
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "ARCHIVED", deletedAt: new Date() }
    });
    return { deleted: true };
  }

  async moveLeadStage(tenantId: string, leadId: string, input: LeadStageMoveInput) {
    await this.getLeadOrThrow(tenantId, leadId);
    await this.assertStage(prisma, tenantId, input.stageId);

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { stageId: input.stageId },
      include: leadInclude()
    });

    return mapLead(lead);
  }

  async markLeadOutcome(tenantId: string, leadId: string, input: LeadOutcomeInput) {
    await this.getLeadOrThrow(tenantId, leadId);
    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { status: input.status },
      include: leadInclude()
    });

    return mapLead(lead);
  }

  async listLeadStages(tenantId: string) {
    return prisma.leadStage.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { position: "asc" }
    });
  }

  async createLeadStage(tenantId: string, input: LeadStageInput) {
    const position =
      input.position ??
      ((await prisma.leadStage.aggregate({
        where: { tenantId, deletedAt: null },
        _max: { position: true }
      }))._max.position ?? -1) + 1;

    if (input.isDefault) {
      await prisma.leadStage.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false }
      });
    }

    return prisma.leadStage.create({
      data: {
        tenantId,
        name: input.name,
        color: input.color ?? "#7c3aed",
        position,
        isDefault: input.isDefault
      }
    });
  }

  private async getCustomerOrThrow(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      include: customerInclude()
    });

    if (!customer) {
      throw notFound("Customer not found");
    }

    return customer;
  }

  private async getLeadOrThrow(tenantId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null },
      include: leadInclude()
    });

    if (!lead) {
      throw notFound("Lead not found");
    }

    return lead;
  }

  private async resolveTag(tenantId: string, input: CustomerTagInput) {
    if (!input.tagId && !input.name) {
      throw notFound("Tag name or tag ID is required");
    }

    if (input.tagId) {
      const tag = await prisma.tag.findFirst({
        where: { id: input.tagId, tenantId, deletedAt: null }
      });

      if (!tag) {
        throw notFound("Tag not found");
      }

      return tag;
    }

    return prisma.tag.upsert({
      where: { tenantId_name: { tenantId, name: input.name as string } },
      update: {
        ...(input.color ? { color: input.color } : {}),
        deletedAt: null
      },
      create: {
        tenantId,
        name: input.name as string,
        color: input.color ?? "#7c3aed"
      }
    });
  }

  private async defaultStage(tx: Prisma.TransactionClient, tenantId: string) {
    const stage =
      (await tx.leadStage.findFirst({
        where: { tenantId, isDefault: true, deletedAt: null },
        orderBy: { position: "asc" }
      })) ??
      (await tx.leadStage.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { position: "asc" }
      }));

    if (!stage) {
      return tx.leadStage.create({
        data: {
          tenantId,
          name: "New",
          color: "#6366f1",
          position: 0,
          isDefault: true
        }
      });
    }

    return stage;
  }

  private async createCustomerForLead(
    tx: Prisma.TransactionClient,
    tenantId: string,
    input: CustomerInput | undefined
  ) {
    if (!input) {
      throw notFound("Customer or customerId is required");
    }

    return tx.customer.upsert({
      where: { tenantId_phone: { tenantId, phone: normalizePhone(input.phone) } },
      update: {
        name: input.name ?? null,
        email: input.email ?? null,
        status: input.status,
        ...(input.customFields ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
        deletedAt: null
      },
      create: {
        tenantId,
        phone: normalizePhone(input.phone),
        name: input.name ?? null,
        email: input.email ?? null,
        status: input.status,
        ...(input.customFields ? { customFields: input.customFields as Prisma.InputJsonValue } : {})
      }
    });
  }

  private async assertCustomer(tx: Prisma.TransactionClient | typeof prisma, tenantId: string, customerId: string) {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null }
    });

    if (!customer) {
      throw notFound("Customer not found");
    }
  }

  private async assertStage(tx: Prisma.TransactionClient | typeof prisma, tenantId: string, stageId: string) {
    const stage = await tx.leadStage.findFirst({
      where: { id: stageId, tenantId, deletedAt: null }
    });

    if (!stage) {
      throw notFound("Lead stage not found");
    }
  }

  private async assertAssignee(tx: Prisma.TransactionClient | typeof prisma, tenantId: string, userId: string) {
    const member = await tx.tenantMember.findFirst({
      where: { tenantId, userId, status: "ACTIVE", deletedAt: null }
    });

    if (!member) {
      throw notFound("Assigned user is not an active tenant member");
    }
  }
}

function customerInclude() {
  return {
    tags: { include: { tag: true } },
    _count: {
      select: {
        conversations: true,
        leads: true,
        notes: true,
        orders: true,
        appointments: true
      }
    }
  };
}

function leadInclude() {
  return {
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      }
    },
    stage: {
      select: {
        id: true,
        name: true,
        color: true,
        position: true
      }
    },
    assignedUser: {
      select: {
        id: true,
        name: true,
        email: true
      }
    },
    _count: {
      select: {
        notes: true
      }
    }
  };
}

function leadWhere(tenantId: string, actorUserId: string, query: LeadsQuery) {
  return {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(query.assignedUserId === "me" ? { assignedUserId: actorUserId } : {}),
    ...(query.assignedUserId === "unassigned" ? { assignedUserId: null } : {}),
    ...(query.assignedUserId && query.assignedUserId !== "me" && query.assignedUserId !== "unassigned"
      ? { assignedUserId: query.assignedUserId }
      : {}),
    ...(query.source ? { source: { contains: query.source, mode: "insensitive" as const } } : {}),
    ...(query.followUpFrom || query.followUpTo
      ? {
          followUpAt: {
            ...(query.followUpFrom ? { gte: query.followUpFrom } : {}),
            ...(query.followUpTo ? { lte: query.followUpTo } : {})
          }
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" as const } },
            { source: { contains: query.search, mode: "insensitive" as const } },
            { customer: { name: { contains: query.search, mode: "insensitive" as const } } },
            { customer: { phone: { contains: query.search, mode: "insensitive" as const } } }
          ]
        }
      : {})
  };
}

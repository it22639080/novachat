import { Prisma, prisma } from "@novachat/database";
import type { AnalyticsRangeQuery } from "@novachat/shared-types";

type Range = {
  from: Date;
  to: Date;
};

const msPerDay = 86_400_000;

function defaultRange(input: AnalyticsRangeQuery): Range {
  const to = input.to ?? new Date();
  const from = input.from ?? new Date(to.getTime() - 29 * msPerDay);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function rangeDays(range: Range) {
  const days: Array<{
    date: string;
    conversations: number;
    leads: number;
    orders: number;
    revenue: number;
    appointments: number;
    aiResponses: number;
    aiCost: number;
    customers: number;
  }> = [];
  const cursor = new Date(range.from);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= range.to) {
    days.push({
      date: dateKey(cursor),
      conversations: 0,
      leads: 0,
      orders: 0,
      revenue: 0,
      appointments: 0,
      aiResponses: 0,
      aiCost: 0,
      customers: 0
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function addByDate<T>(
  days: ReturnType<typeof rangeDays>,
  items: T[],
  date: (item: T) => Date,
  apply: (day: ReturnType<typeof rangeDays>[number], item: T) => void
) {
  const dayMap = new Map(days.map((day) => [day.date, day]));
  for (const item of items) {
    const day = dayMap.get(dateKey(date(item)));
    if (day) {
      apply(day, item);
    }
  }
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function simplePdf(title: string, lines: string[]) {
  const safeLines = [title, "", ...lines].map((line) =>
    line.replace(/[()\\]/g, (match) => `\\${match}`).slice(0, 100)
  );
  const content = ["BT", "/F1 14 Tf", "50 780 Td", ...safeLines.flatMap((line, index) => [
    index === 0 ? `(${line}) Tj` : `0 -18 Td (${line}) Tj`
  ]), "ET"].join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`
  ];
  const header = "%PDF-1.4\n";
  let offset = Buffer.byteLength(header);
  const xref = ["xref", "0 6", "0000000000 65535 f "];
  const body = objects
    .map((object) => {
      xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
      offset += Buffer.byteLength(`${object}\n`);
      return object;
    })
    .join("\n");
  const trailer = `\n${xref.join("\n")}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
  return Buffer.from(`${header}${body}${trailer}`);
}

export class AnalyticsService {
  async overview(tenantId: string, query: AnalyticsRangeQuery) {
    const range = defaultRange(query);
    const [
      conversations,
      messages,
      leads,
      orders,
      orderItems,
      appointments,
      campaignRecipients,
      aiLogs,
      usageEvents,
      customers
    ] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: range.from, lte: range.to }
        },
        select: { id: true, assignedUserId: true, humanHandover: true, createdAt: true }
      }),
      prisma.message.findMany({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: range.from, lte: range.to }
        },
        select: {
          id: true,
          conversationId: true,
          direction: true,
          senderType: true,
          createdAt: true,
          conversation: { select: { assignedUserId: true } }
        }
      }),
      prisma.lead.findMany({
        where: { tenantId, deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
        select: { id: true, status: true, createdAt: true }
      }),
      prisma.order.findMany({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: range.from, lte: range.to },
          status: { notIn: ["CANCELLED", "REFUNDED"] }
        },
        select: { id: true, totalAmount: true, currency: true, status: true, createdAt: true }
      }),
      prisma.orderItem.findMany({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: range.from, lte: range.to },
          productId: { not: null }
        },
        select: { productId: true, name: true, quantity: true, lineTotal: true }
      }),
      prisma.appointment.findMany({
        where: { tenantId, deletedAt: null, startsAt: { gte: range.from, lte: range.to } },
        select: { id: true, status: true, startsAt: true }
      }),
      prisma.campaignRecipient.findMany({
        where: { tenantId, deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
        select: { id: true, status: true, createdAt: true }
      }),
      prisma.aiLog.findMany({
        where: { tenantId, deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
        select: { id: true, status: true, promptTokens: true, outputTokens: true, latencyMs: true, createdAt: true }
      }),
      prisma.usageEvent.findMany({
        where: { tenantId, createdAt: { gte: range.from, lte: range.to } },
        select: { type: true, quantity: true, costEstimate: true, createdAt: true }
      }),
      prisma.customer.findMany({
        where: { tenantId, deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
        select: { id: true, createdAt: true }
      })
    ]);

    const inboundByConversation = new Map<string, Date>();
    const responseTimes: number[] = [];
    for (const message of messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      if (message.direction === "INBOUND") {
        if (!inboundByConversation.has(message.conversationId)) {
          inboundByConversation.set(message.conversationId, message.createdAt);
        }
        continue;
      }

      const inboundAt = inboundByConversation.get(message.conversationId);
      if (inboundAt && message.direction === "OUTBOUND") {
        responseTimes.push(message.createdAt.getTime() - inboundAt.getTime());
        inboundByConversation.delete(message.conversationId);
      }
    }

    const days = rangeDays(range);
    addByDate(days, conversations, (item) => item.createdAt, (day) => {
      day.conversations += 1;
    });
    addByDate(days, leads, (item) => item.createdAt, (day) => {
      day.leads += 1;
    });
    addByDate(days, orders, (item) => item.createdAt, (day, item) => {
      day.orders += 1;
      day.revenue += decimalToNumber(item.totalAmount);
    });
    addByDate(days, appointments, (item) => item.startsAt, (day) => {
      day.appointments += 1;
    });
    addByDate(days, aiLogs, (item) => item.createdAt, (day, item) => {
      if (item.status === "SUCCESS") day.aiResponses += 1;
    });
    addByDate(days, usageEvents, (item) => item.createdAt, (day, item) => {
      day.aiCost += decimalToNumber(item.costEstimate);
    });
    addByDate(days, customers, (item) => item.createdAt, (day) => {
      day.customers += 1;
    });

    const agentIds = Array.from(
      new Set([
        ...conversations.map((item) => item.assignedUserId).filter(Boolean),
        ...messages.map((item) => item.conversation.assignedUserId).filter(Boolean)
      ])
    ) as string[];
    const agents = agentIds.length
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true, email: true }
        })
      : [];
    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
    const agentPerformance = agentIds.map((agentId) => {
      const agentMessages = messages.filter(
        (message) => message.direction === "OUTBOUND" && message.conversation.assignedUserId === agentId
      );
      return {
        agentId,
        name: agentMap.get(agentId)?.name ?? agentMap.get(agentId)?.email ?? "Unknown agent",
        conversations: conversations.filter((conversation) => conversation.assignedUserId === agentId).length,
        replies: agentMessages.length,
        resolved: conversations.filter((conversation) => conversation.assignedUserId === agentId).length
      };
    });

    const topProducts = Array.from(
      orderItems.reduce((map, item) => {
        const key = item.productId ?? item.name;
        const current = map.get(key) ?? { productId: item.productId, name: item.name, quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue += decimalToNumber(item.lineTotal);
        map.set(key, current);
        return map;
      }, new Map<string, { productId: string | null; name: string; quantity: number; revenue: number }>())
    )
      .map(([, value]) => value)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const wonLeads = leads.filter((lead) => lead.status === "WON").length;
    const totalRevenue = orders.reduce((sum, order) => sum + decimalToNumber(order.totalAmount), 0);
    const aiResponses = aiLogs.filter((log) => log.status === "SUCCESS").length;
    const aiCostEstimate = usageEvents.reduce((sum, event) => sum + decimalToNumber(event.costEstimate), 0);

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), timezone: query.timezone },
      stats: {
        totalConversations: conversations.length,
        newConversations: conversations.length,
        aiHandledConversations: new Set(
          messages.filter((message) => message.senderType === "AI").map((message) => message.conversationId)
        ).size,
        humanHandovers: conversations.filter((conversation) => conversation.humanHandover).length,
        averageResponseTimeMs: average(responseTimes),
        leadCount: leads.length,
        leadConversionRate: percent(wonLeads, leads.length),
        revenue: totalRevenue,
        orders: orders.length,
        appointments: appointments.length,
        campaignStats: {
          recipients: campaignRecipients.length,
          sent: campaignRecipients.filter((item) => item.status === "SENT").length,
          delivered: campaignRecipients.filter((item) => item.status === "DELIVERED").length,
          failed: campaignRecipients.filter((item) => item.status === "FAILED").length
        },
        aiResponseCount: aiResponses,
        aiCostEstimate
      },
      series: days,
      leadBreakdown: {
        open: leads.filter((lead) => lead.status === "OPEN").length,
        won: wonLeads,
        lost: leads.filter((lead) => lead.status === "LOST").length,
        archived: leads.filter((lead) => lead.status === "ARCHIVED").length
      },
      orderBreakdown: {
        draft: orders.filter((order) => order.status === "DRAFT").length,
        confirmed: orders.filter((order) => order.status === "CONFIRMED").length,
        paid: orders.filter((order) => order.status === "PAID").length,
        fulfilled: orders.filter((order) => order.status === "FULFILLED").length
      },
      agentPerformance,
      topProducts,
      ai: {
        responses: aiResponses,
        failed: aiLogs.filter((log) => log.status === "FAILED").length,
        blocked: aiLogs.filter((log) => log.status === "BLOCKED").length,
        promptTokens: aiLogs.reduce((sum, log) => sum + log.promptTokens, 0),
        outputTokens: aiLogs.reduce((sum, log) => sum + log.outputTokens, 0),
        averageLatencyMs: average(aiLogs.map((log) => log.latencyMs).filter((value): value is number => value !== null)),
        costEstimate: aiCostEstimate
      }
    };
  }

  async conversations(tenantId: string, query: AnalyticsRangeQuery) {
    const overview = await this.overview(tenantId, query);
    return {
      range: overview.range,
      total: overview.stats.totalConversations,
      new: overview.stats.newConversations,
      aiHandled: overview.stats.aiHandledConversations,
      humanHandovers: overview.stats.humanHandovers,
      averageResponseTimeMs: overview.stats.averageResponseTimeMs,
      series: overview.series.map((day) => ({ date: day.date, conversations: day.conversations }))
    };
  }

  async leads(tenantId: string, query: AnalyticsRangeQuery) {
    const overview = await this.overview(tenantId, query);
    return {
      range: overview.range,
      count: overview.stats.leadCount,
      conversionRate: overview.stats.leadConversionRate,
      breakdown: overview.leadBreakdown,
      series: overview.series.map((day) => ({ date: day.date, leads: day.leads }))
    };
  }

  async orders(tenantId: string, query: AnalyticsRangeQuery) {
    const overview = await this.overview(tenantId, query);
    return {
      range: overview.range,
      revenue: overview.stats.revenue,
      orders: overview.stats.orders,
      breakdown: overview.orderBreakdown,
      topProducts: overview.topProducts,
      series: overview.series.map((day) => ({ date: day.date, orders: day.orders, revenue: day.revenue }))
    };
  }

  async agents(tenantId: string, query: AnalyticsRangeQuery) {
    const overview = await this.overview(tenantId, query);
    return { range: overview.range, items: overview.agentPerformance };
  }

  async ai(tenantId: string, query: AnalyticsRangeQuery) {
    const overview = await this.overview(tenantId, query);
    return {
      range: overview.range,
      ...overview.ai,
      series: overview.series.map((day) => ({
        date: day.date,
        aiResponses: day.aiResponses,
        aiCost: day.aiCost
      }))
    };
  }

  async exportCsv(tenantId: string, query: AnalyticsRangeQuery) {
    const overview = await this.overview(tenantId, query);
    const rows = [
      ["metric", "value"],
      ...Object.entries(overview.stats).map(([key, value]) => [key, JSON.stringify(value)]),
      [],
      ["date", "conversations", "leads", "orders", "revenue", "appointments", "aiResponses", "aiCost", "customers"],
      ...overview.series.map((day) => [
        day.date,
        day.conversations,
        day.leads,
        day.orders,
        day.revenue,
        day.appointments,
        day.aiResponses,
        day.aiCost,
        day.customers
      ])
    ];

    return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  async exportPdf(tenantId: string, query: AnalyticsRangeQuery) {
    const overview = await this.overview(tenantId, query);
    return simplePdf("NovaChat AI Analytics Report", [
      `Range: ${overview.range.from} to ${overview.range.to}`,
      `Conversations: ${overview.stats.totalConversations}`,
      `AI handled conversations: ${overview.stats.aiHandledConversations}`,
      `Human handovers: ${overview.stats.humanHandovers}`,
      `Leads: ${overview.stats.leadCount}`,
      `Lead conversion: ${overview.stats.leadConversionRate}%`,
      `Revenue: ${overview.stats.revenue}`,
      `Orders: ${overview.stats.orders}`,
      `Appointments: ${overview.stats.appointments}`,
      `AI responses: ${overview.stats.aiResponseCount}`,
      `AI cost estimate: ${overview.stats.aiCostEstimate}`
    ]);
  }
}

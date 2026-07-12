"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Bot,
  CalendarDays,
  Download,
  Handshake,
  MessageCircle,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ApiClientError, API_URL, apiClient } from "@/lib/api-client";

type AnalyticsOverview = {
  range: { from: string; to: string; timezone: string };
  stats: {
    totalConversations: number;
    newConversations: number;
    aiHandledConversations: number;
    humanHandovers: number;
    averageResponseTimeMs: number;
    leadCount: number;
    leadConversionRate: number;
    revenue: number;
    orders: number;
    appointments: number;
    campaignStats: { recipients: number; sent: number; delivered: number; failed: number };
    aiResponseCount: number;
    aiCostEstimate: number;
  };
  series: Array<{
    date: string;
    conversations: number;
    leads: number;
    orders: number;
    revenue: number;
    appointments: number;
    aiResponses: number;
    aiCost: number;
    customers: number;
  }>;
  leadBreakdown: { open: number; won: number; lost: number; archived: number };
  orderBreakdown: { draft: number; confirmed: number; paid: number; fulfilled: number };
  agentPerformance: Array<{ agentId: string; name: string; conversations: number; replies: number; resolved: number }>;
  topProducts: Array<{ productId: string | null; name: string; quantity: number; revenue: number }>;
  ai: {
    responses: number;
    failed: number;
    blocked: number;
    promptTokens: number;
    outputTokens: number;
    averageLatencyMs: number;
    costEstimate: number;
  };
};

const pieColors = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6"];

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(value);
}

function formatDuration(ms: number) {
  if (!ms) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Could not load analytics.";
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Bot;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <p className="mt-3 truncate text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function chartTooltip() {
  return {
    borderRadius: 8,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--card))",
    color: "hsl(var(--foreground))"
  };
}

export default function AnalyticsPage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [from, setFrom] = React.useState(defaultFrom());
  const [to, setTo] = React.useState(today());
  const [overview, setOverview] = React.useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState<string | null>(null);

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams({
      from: new Date(`${from}T00:00:00.000Z`).toISOString(),
      to: new Date(`${to}T23:59:59.999Z`).toISOString(),
      timezone: "Asia/Colombo"
    });
    return params.toString();
  }, [from, to]);

  const load = React.useCallback(async () => {
    if (!tenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.get<AnalyticsOverview>(`/analytics/overview?${queryString}`, { tenantId });
      setOverview(result);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [queryString, tenantId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function exportUrl(type: "csv" | "pdf") {
    return `${API_URL}/analytics/export/${type}?${queryString}`;
  }

  const leadPie = overview
    ? [
        { name: "Open", value: overview.leadBreakdown.open },
        { name: "Won", value: overview.leadBreakdown.won },
        { name: "Lost", value: overview.leadBreakdown.lost },
        { name: "Archived", value: overview.leadBreakdown.archived }
      ]
    : [];

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <Badge variant="neutral">Tenant analytics</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor conversations, AI coverage, CRM, revenue, bookings, campaigns, agents, and cost trends.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="From date" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="To date" />
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
          <Button type="button" variant="outline" onClick={() => window.open(exportUrl("csv"))}>
            <Download className="h-4 w-4" />CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => window.open(exportUrl("pdf"))}>
            <Download className="h-4 w-4" />PDF
          </Button>
        </div>
      </div>

      {notice ? <div className="rounded-lg border bg-card px-4 py-3 text-sm">{notice}</div> : null}

      {overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Conversations" value={formatNumber(overview.stats.totalConversations)} detail={`${formatNumber(overview.stats.aiHandledConversations)} AI handled`} icon={MessageCircle} />
            <MetricCard title="Human handovers" value={formatNumber(overview.stats.humanHandovers)} detail={`Avg response ${formatDuration(overview.stats.averageResponseTimeMs)}`} icon={Handshake} />
            <MetricCard title="Revenue" value={formatMoney(overview.stats.revenue)} detail={`${formatNumber(overview.stats.orders)} orders`} icon={WalletCards} />
            <MetricCard title="Appointments" value={formatNumber(overview.stats.appointments)} detail={`${formatNumber(overview.stats.leadCount)} leads · ${overview.stats.leadConversionRate}% conversion`} icon={CalendarDays} />
            <MetricCard title="AI responses" value={formatNumber(overview.stats.aiResponseCount)} detail={`${formatMoney(overview.stats.aiCostEstimate)} estimated cost`} icon={Bot} />
            <MetricCard title="Customers" value={formatNumber(overview.series.reduce((sum, day) => sum + day.customers, 0))} detail="New customers in selected range" icon={UsersRound} />
            <MetricCard title="Campaigns" value={formatNumber(overview.stats.campaignStats.recipients)} detail={`${formatNumber(overview.stats.campaignStats.delivered)} delivered`} icon={TrendingUp} />
            <MetricCard title="Top product revenue" value={formatMoney(overview.topProducts[0]?.revenue ?? 0)} detail={overview.topProducts[0]?.name ?? "No product sales yet"} icon={ShoppingBag} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Business trend</CardTitle>
                <CardDescription>Revenue, conversations, leads, and appointments over time.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overview.series} margin={{ left: 0, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="analyticsRevenue" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
                      <Tooltip contentStyle={chartTooltip()} />
                      <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#analyticsRevenue)" strokeWidth={2} />
                      <Line type="monotone" dataKey="conversations" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="appointments" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead conversion</CardTitle>
                <CardDescription>Lead status mix for the selected period.</CardDescription>
              </CardHeader>
              <CardContent>
                {leadPie.some((item) => item.value > 0) ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={leadPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                          {leadPie.map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTooltip()} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon={TrendingUp} title="No leads in range" description="Lead conversion charts appear after CRM activity exists." />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Agent performance</CardTitle>
                <CardDescription>Conversation ownership and replies by assigned team member.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.agentPerformance.length ? overview.agentPerformance.map((agent) => (
                  <div key={agent.agentId} className="grid grid-cols-[minmax(0,1fr)_80px_80px] gap-3 rounded-lg border p-3 text-sm">
                    <p className="truncate font-medium">{agent.name}</p>
                    <p className="text-muted-foreground">{agent.conversations} chats</p>
                    <p className="text-muted-foreground">{agent.replies} replies</p>
                  </div>
                )) : <EmptyState icon={UsersRound} title="No agent activity" description="Assigned conversations and replies appear here." />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top products</CardTitle>
                <CardDescription>Best-selling products by revenue in the selected range.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.topProducts.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.topProducts} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={120} tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip contentStyle={chartTooltip()} />
                        <Bar dataKey="revenue" fill="#10b981" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon={ShoppingBag} title="No product revenue" description="Confirmed order items appear once products sell." />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI analytics</CardTitle>
              <CardDescription>AI replies, blocked/failed requests, latency, tokens, and estimated cost.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overview.series}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} width={42} />
                      <Tooltip contentStyle={chartTooltip()} />
                      <Line type="monotone" dataKey="aiResponses" stroke="#2563eb" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="aiCost" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="rounded-md border p-3"><p className="text-muted-foreground">Failed</p><p className="mt-1 font-semibold">{overview.ai.failed}</p></div>
                  <div className="rounded-md border p-3"><p className="text-muted-foreground">Blocked</p><p className="mt-1 font-semibold">{overview.ai.blocked}</p></div>
                  <div className="rounded-md border p-3"><p className="text-muted-foreground">Tokens</p><p className="mt-1 font-semibold">{formatNumber(overview.ai.promptTokens + overview.ai.outputTokens)}</p></div>
                  <div className="rounded-md border p-3"><p className="text-muted-foreground">Avg latency</p><p className="mt-1 font-semibold">{overview.ai.averageLatencyMs}ms</p></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState icon={TrendingUp} title="No analytics data" description="Analytics appears after conversations, leads, orders, appointments, or AI events exist." />
      )}
    </div>
  );
}

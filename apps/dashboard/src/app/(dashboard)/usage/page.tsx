"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Bot, CreditCard, MessageCircle, RefreshCw, WalletCards } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge, Button, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiClientError, apiClient } from "@/lib/api-client";

type UsageSummary = {
  planName: string;
  billingStatus: string;
  aiMonthlyReplyLimit: number;
  aiRepliesUsedThisMonth: number;
  aiInputTokensUsed: number;
  aiOutputTokensUsed: number;
  whatsappMonthlyMessageLimit: number;
  whatsappMessagesUsedThisMonth: number;
  extraAiReplyCredits: number;
  extraWhatsappMessageCredits: number;
  aiDisabledDueToLimit: boolean;
  whatsappDisabledDueToLimit: boolean;
  currentAiModel: string;
  dailyAiCostLimit: number;
  monthlyAiCostLimit: number;
  aiCostUsedToday: number;
  aiCostUsedThisMonth: number;
  billingCycleStart: string;
  billingCycleEnd: string | null;
  lastUsageResetAt: string | null;
  warnings: {
    aiReplies: { eighty: boolean; ninety: boolean; hundred: boolean };
    whatsappMessages: { eighty: boolean; ninety: boolean; hundred: boolean };
    dailyAiCost: { eighty: boolean; ninety: boolean; hundred: boolean };
    monthlyAiCost: { eighty: boolean; ninety: boolean; hundred: boolean };
  };
};

type UsageEvent = {
  id: string;
  type: string;
  quantity: number;
  costEstimate: number;
  metadata: unknown;
  createdAt: string;
};

type PaginatedResult<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type CostDay = {
  date: string;
  aiReplies: number;
  whatsappMessages: number;
  aiCost: number;
  inputTokens: number;
  outputTokens: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value)
  );
}

function ratio(used: number, limit: number) {
  if (limit <= 0) {
    return used > 0 ? 100 : 0;
  }

  return Math.min(Math.round((used / limit) * 100), 100);
}

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Could not load usage data.";
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  percent
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Bot;
  percent?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-background">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      {percent !== undefined ? (
        <div className="mt-4 h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </motion.div>
  );
}

export default function UsagePage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [summary, setSummary] = React.useState<UsageSummary | null>(null);
  const [events, setEvents] = React.useState<UsageEvent[]>([]);
  const [costs, setCosts] = React.useState<CostDay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!tenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [summaryResult, eventResult, costResult] = await Promise.all([
        apiClient.get<UsageSummary>("/usage/summary", { tenantId }),
        apiClient.get<PaginatedResult<UsageEvent>>("/usage/events?page=1&pageSize=20", { tenantId }),
        apiClient.get<{ days: CostDay[] }>("/usage/costs?days=30", { tenantId })
      ]);
      setSummary(summaryResult);
      setEvents(eventResult.items);
      setCosts(costResult.days);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-40 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <Badge variant="neutral">Usage and limits</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">Usage dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track AI replies, WhatsApp messages, credits, token volume, and estimated AI cost.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {notice ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-200">
          {notice}
        </div>
      ) : null}

      {summary ? (
        <>
          {(summary.warnings.aiReplies.eighty ||
            summary.warnings.whatsappMessages.eighty ||
            summary.warnings.dailyAiCost.eighty ||
            summary.warnings.monthlyAiCost.eighty ||
            summary.aiDisabledDueToLimit ||
            summary.whatsappDisabledDueToLimit) && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-100">Usage needs attention</p>
                <p className="mt-1 text-amber-700 dark:text-amber-200">
                  One or more limits are above 80%, or a service was disabled by limit enforcement.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="AI replies"
              value={`${formatNumber(summary.aiRepliesUsedThisMonth)} / ${formatNumber(summary.aiMonthlyReplyLimit)}`}
              detail={`${formatNumber(summary.extraAiReplyCredits)} extra AI credits available`}
              icon={Bot}
              percent={ratio(summary.aiRepliesUsedThisMonth, summary.aiMonthlyReplyLimit)}
            />
            <MetricCard
              title="WhatsApp messages"
              value={`${formatNumber(summary.whatsappMessagesUsedThisMonth)} / ${formatNumber(summary.whatsappMonthlyMessageLimit)}`}
              detail={`${formatNumber(summary.extraWhatsappMessageCredits)} extra message credits available`}
              icon={MessageCircle}
              percent={ratio(summary.whatsappMessagesUsedThisMonth, summary.whatsappMonthlyMessageLimit)}
            />
            <MetricCard
              title="AI cost today"
              value={formatMoney(summary.aiCostUsedToday)}
              detail={`Daily limit ${formatMoney(summary.dailyAiCostLimit)}`}
              icon={WalletCards}
              percent={ratio(summary.aiCostUsedToday, summary.dailyAiCostLimit)}
            />
            <MetricCard
              title="Current plan"
              value={summary.planName}
              detail={`${summary.billingStatus} / model ${summary.currentAiModel}`}
              icon={CreditCard}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Daily usage trend</h2>
                  <p className="mt-1 text-xs text-muted-foreground">AI replies, WhatsApp messages, and estimated AI cost.</p>
                </div>
                <Badge variant="neutral">30 days</Badge>
              </div>
              {costs.length ? (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={costs}>
                      <defs>
                        <linearGradient id="aiUsage" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="aiReplies" stroke="#22c55e" fill="url(#aiUsage)" />
                      <Area type="monotone" dataKey="whatsappMessages" stroke="#3b82f6" fill="transparent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                  No usage events yet. AI replies and WhatsApp sends will appear here after activity starts.
                </div>
              )}
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Cycle and tokens</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Input tokens</span>
                  <span>{formatNumber(summary.aiInputTokensUsed)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Output tokens</span>
                  <span>{formatNumber(summary.aiOutputTokensUsed)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Monthly AI cost</span>
                  <span>{formatMoney(summary.aiCostUsedThisMonth)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cycle start</span>
                  <span>{formatDate(summary.billingCycleStart)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cycle end</span>
                  <span>{formatDate(summary.billingCycleEnd)}</span>
                </div>
              </div>
              <Button type="button" className="mt-5 w-full" variant="outline">
                Request top-up
              </Button>
            </section>
          </div>

          <section className="rounded-lg border bg-card shadow-sm">
            <div className="border-b p-4">
              <h2 className="text-sm font-semibold">Usage events</h2>
              <p className="mt-1 text-xs text-muted-foreground">Append-only billing and limit activity.</p>
            </div>
            {events.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Quantity</th>
                      <th className="px-4 py-3 font-medium">Cost</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <Badge variant="neutral">{event.type}</Badge>
                        </td>
                        <td className="px-4 py-3">{formatNumber(event.quantity)}</td>
                        <td className="px-4 py-3">{formatMoney(event.costEstimate)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(event.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">No usage events recorded yet.</div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  CreditCard,
  FileText,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ApiClientError, apiClient } from "@/lib/api-client";

type PlanLimits = {
  whatsappAccounts: number;
  teamMembers: number;
  aiMonthlyReplies: number;
  monthlyConversations: number;
  monthlyCampaignSends: number;
  knowledgeBaseStorageMb: number;
  chatbots: number;
  advancedAnalytics: boolean;
  integrations: boolean;
  dailyAiCostLimit: number;
  monthlyAiCostLimit: number;
};

type Plan = {
  id: string;
  code: "starter" | "business" | "professional" | "enterprise";
  name: string;
  description: string | null;
  priceMonthly: number;
  currency: string;
  limits: PlanLimits;
  isActive: boolean;
};

type Subscription = {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
} | null;

type Invoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

type Paginated<T> = { items: T[]; pagination: { total: number } };

type BillingUsage = {
  summary: {
    planName: string;
    billingStatus: string;
    aiMonthlyReplyLimit: number;
    aiRepliesUsedThisMonth: number;
    whatsappMonthlyMessageLimit: number;
    whatsappMessagesUsedThisMonth: number;
    aiCostUsedToday: number;
    aiCostUsedThisMonth: number;
    dailyAiCostLimit: number;
    monthlyAiCostLimit: number;
  };
  counts: {
    whatsappAccounts: number;
    teamMembers: number;
    monthlyConversations: number;
    monthlyCampaignSends: number;
    chatbots: number;
    knowledgeBaseStorageMb: number;
  };
  limits: PlanLimits;
  allowances: Record<string, { used?: number; limit?: number; remaining?: number; exceeded?: boolean; ratio?: number; enabled?: boolean }>;
};

function money(plan: Pick<Plan, "currency" | "priceMonthly">) {
  return new Intl.NumberFormat("en", { style: "currency", currency: plan.currency }).format(plan.priceMonthly);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not set";
}

function percent(value: number | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function errorText(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Could not load billing.";
}

function UsageCard({ title, used, limit, icon: Icon }: { title: string; used: number; limit: number; icon: React.ComponentType<{ className?: string }> }) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 1;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-semibold">{used.toLocaleString()} / {limit.toLocaleString()}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: percent(ratio) }} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillingPage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [subscription, setSubscription] = React.useState<Subscription>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [usage, setUsage] = React.useState<BillingUsage | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<Plan["code"]>("business");
  const [provider, setProvider] = React.useState<"manual" | "stripe" | "payhere">("manual");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const loadBilling = React.useCallback(async () => {
    if (!tenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [planResult, subscriptionResult, invoiceResult, usageResult] = await Promise.all([
        apiClient.get<Plan[]>("/billing/plans"),
        apiClient.get<Subscription>("/billing/subscription", { tenantId }),
        apiClient.get<Paginated<Invoice>>("/billing/invoices?page=1&pageSize=20&sortBy=createdAt&sortDirection=desc", { tenantId }),
        apiClient.get<BillingUsage>("/billing/usage", { tenantId })
      ]);
      setPlans(planResult);
      setSubscription(subscriptionResult);
      setInvoices(invoiceResult.items);
      setUsage(usageResult);
      setSelectedPlan((subscriptionResult?.plan.code as Plan["code"]) ?? "business");
      setNotice(null);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  async function subscribe(planCode: Plan["code"]) {
    if (!tenantId) return;
    setSaving(true);
    try {
      const endpoint = subscription ? "/billing/upgrade" : "/billing/subscribe";
      await apiClient.post(endpoint, { planCode, provider, trialDays: subscription ? 0 : 14 }, { tenantId });
      setNotice(subscription ? "Plan updated. Usage limits were synced." : "Subscription started with a trial period.");
      await loadBilling();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function cancelSubscription() {
    if (!tenantId) return;
    setSaving(true);
    try {
      await apiClient.post("/billing/cancel", { cancelAtPeriodEnd: true, reason: "Requested from dashboard" }, { tenantId });
      setNotice("Subscription will cancel at period end.");
      await loadBilling();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="neutral" className="mb-3">Subscription billing</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Manage plans, invoices, usage limits, trials, upgrades, and payment-provider placeholders for the active tenant.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadBilling()} disabled={loading || saving}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </motion.div>

      {notice ? <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Current subscription</CardTitle>
                <CardDescription>Trial, renewal, and cancellation status.</CardDescription>
              </CardHeader>
              <CardContent>
                {subscription ? (
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Plan</p><p className="mt-1 text-xl font-semibold">{subscription.plan.name}</p></div>
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Status</p><p className="mt-1 text-xl font-semibold">{subscription.status}</p></div>
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Renews</p><p className="mt-1 text-xl font-semibold">{formatDate(subscription.currentPeriodEnd)}</p></div>
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Trial ends</p><p className="mt-1 text-xl font-semibold">{formatDate(subscription.trialEndsAt)}</p></div>
                  </div>
                ) : (
                  <EmptyState icon={CreditCard} title="No subscription yet" description="Choose a plan below to start a tenant subscription." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment method</CardTitle>
                <CardDescription>Provider integrations are placeholders for this phase.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}>
                  <option value="manual">Manual invoice</option>
                  <option value="stripe">Stripe placeholder</option>
                  <option value="payhere">PayHere placeholder</option>
                </select>
                <Button variant="outline" className="w-full" disabled>
                  <WalletCards className="h-4 w-4" /> Add payment method
                </Button>
                {subscription ? (
                  <Button variant="outline" className="w-full" onClick={() => void cancelSubscription()} disabled={saving || subscription.cancelAtPeriodEnd}>
                    Cancel at period end
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {usage ? (
            <div className="grid gap-3 lg:grid-cols-4">
              <UsageCard title="AI replies" used={usage.summary.aiRepliesUsedThisMonth} limit={usage.summary.aiMonthlyReplyLimit} icon={Bot} />
              <UsageCard title="WhatsApp messages" used={usage.summary.whatsappMessagesUsedThisMonth} limit={usage.summary.whatsappMonthlyMessageLimit} icon={Sparkles} />
              <UsageCard title="Team members" used={usage.counts.teamMembers} limit={usage.limits.teamMembers} icon={UsersRound} />
              <UsageCard title="Chatbots" used={usage.counts.chatbots} limit={usage.limits.chatbots} icon={ShieldCheck} />
              <UsageCard title="Conversations" used={usage.counts.monthlyConversations} limit={usage.limits.monthlyConversations} icon={CreditCard} />
              <UsageCard title="Campaign sends" used={usage.counts.monthlyCampaignSends} limit={usage.limits.monthlyCampaignSends} icon={BarChart3} />
              <UsageCard title="Knowledge MB" used={usage.counts.knowledgeBaseStorageMb} limit={usage.limits.knowledgeBaseStorageMb} icon={FileText} />
              <UsageCard title="Monthly AI cost" used={Math.round(usage.summary.aiCostUsedThisMonth)} limit={Math.round(usage.summary.monthlyAiCostLimit)} icon={WalletCards} />
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Pricing plans</CardTitle>
              <CardDescription>Upgrade or downgrade the tenant plan. Limits sync immediately after change.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-4">
              {plans.map((plan) => (
                <div key={plan.id} className={`rounded-lg border p-4 ${subscription?.plan.code === plan.code ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {subscription?.plan.code === plan.code ? <Badge variant="success">Current</Badge> : null}
                  </div>
                  <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-4 text-3xl font-semibold">{money(plan)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <div className="mt-4 space-y-2 text-sm">
                    <p><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-500" />{plan.limits.whatsappAccounts} WhatsApp accounts</p>
                    <p><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-500" />{plan.limits.teamMembers} team members</p>
                    <p><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-500" />{plan.limits.aiMonthlyReplies.toLocaleString()} AI replies</p>
                    <p><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-500" />{plan.limits.monthlyCampaignSends.toLocaleString()} campaign sends</p>
                    <p><PlugZap className="mr-2 inline h-4 w-4 text-primary" />{plan.limits.integrations ? "Integrations included" : "Core integrations only"}</p>
                  </div>
                  <Button className="mt-5 w-full" variant={subscription?.plan.code === plan.code ? "outline" : "default"} onClick={() => void subscribe(plan.code)} disabled={saving || subscription?.plan.code === plan.code}>
                    {subscription ? "Switch plan" : "Start trial"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Generated subscription invoices and placeholder payment records.</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-2">Number</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Due</th>
                        <th>Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-t">
                          <td className="py-3 font-medium">{invoice.number}</td>
                          <td><Badge variant={invoice.status === "PAID" ? "success" : "neutral"}>{invoice.status}</Badge></td>
                          <td>{invoice.currency} {invoice.total.toLocaleString()}</td>
                          <td>{formatDate(invoice.dueAt)}</td>
                          <td>{formatDate(invoice.paidAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={FileText} title="No invoices yet" description="Invoices are generated when a tenant subscribes or changes plan." />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

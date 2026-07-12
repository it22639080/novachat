"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  Building2,
  CreditCard,
  FileClock,
  Gauge,
  HeartPulse,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@novachat/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error: { message: string } };
type Paginated<T> = { items: T[]; pagination: { total: number } };

type Overview = {
  totals: {
    tenants: number;
    activeTenants: number;
    users: number;
    monthlyConversations: number;
    monthlyAiReplies: number;
    monthlyWhatsappMessages: number;
    monthlyCampaignRecipients: number;
    storageMb: number;
    invoiceTotal: number;
    paidTotal: number;
    invoices: number;
    payments: number;
  };
  placeholders: { supportTickets: number; featureFlags: number; announcements: number };
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  members: number;
  customers: number;
  conversations: number;
  campaigns: number;
  plan: string;
  billingStatus: string;
  createdAt: string;
};

type TenantDetail = Tenant & {
  usageCounter: {
    aiRepliesUsedThisMonth: number;
    whatsappMessagesUsedThisMonth: number;
    aiCostUsedThisMonth: number;
    aiDisabledDueToLimit: boolean;
    whatsappDisabledDueToLimit: boolean;
  } | null;
  subscriptions: Array<{ id: string; status: string; plan: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean }>;
  members: Array<{ id: string; role: string; status: string; user: { email: string; name: string | null } }>;
  invoices: Array<{ id: string; number: string; status: string; total: number; currency: string }>;
  payments: Array<{ id: string; status: string; amount: number; provider: string | null; currency: string }>;
  whatsappAccounts: Array<{
    id: string;
    onboardingMethod: string;
    status: string;
    displayPhoneNumber: string;
    displayName: string | null;
    verifiedName: string | null;
    phoneNumberId: string;
    wabaId: string | null;
    qualityRating: string | null;
    connectedAt: string | null;
    disconnectedAt: string | null;
    lastHealthCheckAt: string | null;
    lastWebhookAt: string | null;
    setupErrors: unknown;
    metaConnectionLogs: Array<{ id: string; eventType: string; status: string; message: string; createdAt: string }>;
    webhookLogs: Array<{ id: string; phoneNumberId: string | null; status: string; errorMessage: string | null; createdAt: string }>;
  }>;
  counts: Record<string, number>;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  tenants: Array<{ tenant: { id: string; name: string; slug: string }; role: string; status: string }>;
  createdAt: string;
};

type PlanRow = { id: string; code: string; name: string; priceMonthly: number; currency: string; isActive: boolean };
type SubscriptionRow = { id: string; tenant: { name: string; slug: string }; plan: string; status: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean };
type BillingData = {
  invoices: Paginated<{ id: string; tenant: { name: string; slug: string }; number: string; status: string; total: number; currency: string; createdAt: string }>;
  payments: { total: number; items: Array<{ id: string; tenant: { name: string; slug: string }; status: string; amount: number; currency: string; provider: string | null; createdAt: string }> };
};
type UsageRow = {
  tenant: { id: string; name: string; slug: string };
  aiRepliesUsedThisMonth: number;
  whatsappMessagesUsedThisMonth: number;
  aiCostUsedThisMonth: number;
  storageMb: number;
  campaignRecipients: number;
  aiDisabledDueToLimit: boolean;
  whatsappDisabledDueToLimit: boolean;
};
type AuditLog = { id: string; tenant: { name: string; slug: string }; actor: { email: string; name: string | null } | null; action: string; entityType: string; createdAt: string };
type SystemHealth = { status: string; database: string; redis: string; queues: string[]; checks: Record<string, number>; checkedAt: string };
type SettingsData = { featureFlags: Record<string, boolean>; supportTickets: unknown[]; announcements: unknown[] };

const nav = [
  ["overview", "Overview", Gauge],
  ["businesses", "Businesses", Building2],
  ["users", "Users", UsersRound],
  ["plans", "Plans", SlidersHorizontal],
  ["subscriptions", "Subscriptions", CreditCard],
  ["billing", "Billing", WalletCards],
  ["usage", "Usage", Activity],
  ["audit", "Audit logs", FileClock],
  ["health", "System health", HeartPulse],
  ["settings", "Settings", Settings]
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : "Not set";
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-novachat-csrf": "same-origin",
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (!response.ok || !body || body.success === false) {
    throw new Error(body && body.success === false ? body.error.message : `Request failed with ${response.status}`);
  }

  return body.data;
}

function StatCard({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminHomePage() {
  const [active, setActive] = React.useState<(typeof nav)[number][0]>("overview");
  const [email, setEmail] = React.useState("admin@novachat.ai");
  const [password, setPassword] = React.useState("");
  const [isAuthed, setIsAuthed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [tenantDetail, setTenantDetail] = React.useState<TenantDetail | null>(null);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [plans, setPlans] = React.useState<PlanRow[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<SubscriptionRow[]>([]);
  const [billing, setBilling] = React.useState<BillingData | null>(null);
  const [usage, setUsage] = React.useState<UsageRow[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);
  const [health, setHealth] = React.useState<SystemHealth | null>(null);
  const [settings, setSettings] = React.useState<SettingsData | null>(null);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [me, overviewData, tenantData, userData, planData, subscriptionData, billingData, usageData, auditData, healthData, settingsData] =
        await Promise.all([
          apiRequest<{ user: { isSuperAdmin: boolean } }>("/auth/me"),
          apiRequest<Overview>("/admin/overview"),
          apiRequest<Paginated<Tenant>>(`/admin/tenants?page=1&pageSize=50&search=${encodeURIComponent(search)}`),
          apiRequest<Paginated<UserRow>>("/admin/users?page=1&pageSize=50"),
          apiRequest<PlanRow[]>("/admin/plans"),
          apiRequest<Paginated<SubscriptionRow>>("/admin/subscriptions?page=1&pageSize=50"),
          apiRequest<BillingData>("/admin/billing?page=1&pageSize=50"),
          apiRequest<UsageRow[]>("/admin/usage"),
          apiRequest<Paginated<AuditLog>>("/admin/audit-logs?page=1&pageSize=50"),
          apiRequest<SystemHealth>("/admin/system-health"),
          apiRequest<SettingsData>("/admin/settings")
        ]);
      if (!me.user.isSuperAdmin) throw new Error("Super admin access is required.");
      setIsAuthed(true);
      setOverview(overviewData);
      setTenants(tenantData.items);
      setUsers(userData.items);
      setPlans(planData);
      setSubscriptions(subscriptionData.items);
      setBilling(billingData);
      setUsage(usageData);
      setAuditLogs(auditData.items);
      setHealth(healthData);
      setSettings(settingsData);
      setNotice(null);
    } catch (error) {
      setIsAuthed(false);
      setNotice(error instanceof Error ? error.message : "Could not load super admin data.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      await loadAll();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTenant(id: string) {
    setTenantDetail(await apiRequest<TenantDetail>(`/admin/tenants/${id}`));
    setActive("businesses");
  }

  async function setTenantStatus(id: string, status: Tenant["status"]) {
    await apiRequest(`/admin/tenants/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason: "Updated from super admin panel" })
    });
    await loadAll();
    await loadTenant(id);
  }

  async function runWhatsappHealthCheck(accountId: string) {
    if (!tenantDetail) return;
    await apiRequest(`/admin/tenants/${tenantDetail.id}/whatsapp/${accountId}/health-check`, {
      method: "POST"
    });
    await loadTenant(tenantDetail.id);
  }

  async function disconnectWhatsapp(accountId: string) {
    if (!tenantDetail) return;
    await apiRequest(`/admin/tenants/${tenantDetail.id}/whatsapp/${accountId}/disconnect`, {
      method: "POST",
      body: JSON.stringify({ reason: "Disconnected from super admin panel" })
    });
    await loadTenant(tenantDetail.id);
  }

  async function overrideWhatsappStatus(accountId: string, status: string) {
    if (!tenantDetail) return;
    await apiRequest(`/admin/tenants/${tenantDetail.id}/whatsapp/${accountId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await loadTenant(tenantDetail.id);
  }

  async function updateFlags() {
    if (!settings) return;
    const result = await apiRequest<{ featureFlags: Record<string, boolean>; message: string }>("/admin/settings/feature-flags", {
      method: "PATCH",
      body: JSON.stringify(settings.featureFlags)
    });
    setNotice(result.message);
  }

  async function createAnnouncement() {
    const result = await apiRequest<{ message: string }>("/admin/announcements", {
      method: "POST",
      body: JSON.stringify({
        title: "Platform notice",
        message: "NovaChat AI maintenance window placeholder.",
        audience: "ALL"
      })
    });
    setNotice(result.message);
  }

  if (!isAuthed && !loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Badge variant="warning" className="w-fit">SUPER ADMIN</Badge>
            <CardTitle>NOVA TECH Platform Login</CardTitle>
            <CardDescription>Only users with `SUPER_ADMIN` access can open this portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void login(event)}>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
              {notice ? <p className="text-sm text-amber-600">{notice}</p> : null}
              <Button className="w-full" disabled={loading}>Login</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r bg-card/90 px-4 py-5 lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">NOVA TECH</p>
            <p className="text-xs text-muted-foreground">NovaChat AI Super Admin</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1 text-sm">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition ${active === key ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-medium">Platform owner console</p>
            <p className="text-xs text-muted-foreground">Businesses, users, billing, usage, health, and controls</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadAll()} disabled={loading}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Badge variant="warning">Super Admin</Badge>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {notice ? <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : null}

          {!loading && overview && active === "overview" ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div>
                <Badge variant="neutral">Platform overview</Badge>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">NovaChat AI operations</h1>
                <p className="mt-2 max-w-3xl text-muted-foreground">Monitor platform-wide adoption, usage, billing, queues, and operational placeholders from one admin portal.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Businesses" value={formatNumber(overview.totals.tenants)} detail={`${overview.totals.activeTenants} active`} icon={Building2} />
                <StatCard title="Users" value={formatNumber(overview.totals.users)} detail="All platform users" icon={UsersRound} />
                <StatCard title="AI replies" value={formatNumber(overview.totals.monthlyAiReplies)} detail="This billing month" icon={Activity} />
                <StatCard title="WhatsApp messages" value={formatNumber(overview.totals.monthlyWhatsappMessages)} detail="Current tenant counters" icon={Megaphone} />
                <StatCard title="Conversations" value={formatNumber(overview.totals.monthlyConversations)} detail="New this month" icon={Gauge} />
                <StatCard title="Storage" value={`${formatNumber(overview.totals.storageMb)} MB`} detail="Knowledge base files" icon={FileClock} />
                <StatCard title="Invoices" value={money(overview.totals.invoiceTotal)} detail={`${overview.totals.invoices} invoices`} icon={CreditCard} />
                <StatCard title="Paid revenue" value={money(overview.totals.paidTotal)} detail={`${overview.totals.payments} payments`} icon={WalletCards} />
              </div>
            </motion.div>
          ) : null}

          {!loading && active === "businesses" ? (
            <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader>
                  <CardTitle>Businesses</CardTitle>
                  <CardDescription>Activate, suspend, inspect tenant usage and commercial state.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <input className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search businesses" />
                    <Button variant="outline" onClick={() => void loadAll()}><Search className="h-4 w-4" /> Search</Button>
                  </div>
                  {tenants.map((tenant) => (
                    <button key={tenant.id} type="button" onClick={() => void loadTenant(tenant.id)} className="w-full rounded-lg border p-4 text-left transition hover:bg-muted">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold">{tenant.name}</p>
                          <p className="text-sm text-muted-foreground">{tenant.slug} · {tenant.plan} · {tenant.members} members</p>
                        </div>
                        <Badge variant={tenant.status === "ACTIVE" ? "success" : "warning"}>{tenant.status}</Badge>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Business details</CardTitle>
                  <CardDescription>{tenantDetail ? tenantDetail.name : "Select a business."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tenantDetail ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md border p-3"><p className="text-muted-foreground">Customers</p><p className="font-semibold">{tenantDetail.counts.customers}</p></div>
                        <div className="rounded-md border p-3"><p className="text-muted-foreground">Messages</p><p className="font-semibold">{tenantDetail.counts.messages}</p></div>
                        <div className="rounded-md border p-3"><p className="text-muted-foreground">Campaigns</p><p className="font-semibold">{tenantDetail.counts.campaigns}</p></div>
                        <div className="rounded-md border p-3"><p className="text-muted-foreground">Chatbots</p><p className="font-semibold">{tenantDetail.counts.chatbots}</p></div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => void setTenantStatus(tenantDetail.id, "ACTIVE")}>Activate</Button>
                        <Button variant="outline" onClick={() => void setTenantStatus(tenantDetail.id, "SUSPENDED")}>Suspend</Button>
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Usage</p>
                        <p className="text-muted-foreground">AI replies: {tenantDetail.usageCounter?.aiRepliesUsedThisMonth ?? 0}</p>
                        <p className="text-muted-foreground">WhatsApp messages: {tenantDetail.usageCounter?.whatsappMessagesUsedThisMonth ?? 0}</p>
                        <p className="text-muted-foreground">AI cost: {money(tenantDetail.usageCounter?.aiCostUsedThisMonth ?? 0)}</p>
                      </div>
                      <div className="space-y-3 rounded-md border p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <MessageSquareText className="h-4 w-4" />
                          <p className="font-medium">WhatsApp connections</p>
                        </div>
                        {tenantDetail.whatsappAccounts.length ? (
                          tenantDetail.whatsappAccounts.map((account) => (
                            <div key={account.id} className="space-y-2 rounded-md border bg-background p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium">{account.displayName ?? account.displayPhoneNumber}</p>
                                  <p className="text-muted-foreground">{account.onboardingMethod} / {account.phoneNumberId}</p>
                                  <p className="text-muted-foreground">Last webhook: {formatDate(account.lastWebhookAt)}</p>
                                </div>
                                <Badge variant={account.status === "CONNECTED" ? "success" : "warning"}>{account.status}</Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => void runWhatsappHealthCheck(account.id)}>Health</Button>
                                <Button variant="outline" onClick={() => void overrideWhatsappStatus(account.id, "CONNECTED")}>Mark connected</Button>
                                <Button variant="outline" onClick={() => void disconnectWhatsapp(account.id)}>Disconnect</Button>
                              </div>
                              {account.metaConnectionLogs[0] ? (
                                <p className="text-xs text-muted-foreground">
                                  Latest: {account.metaConnectionLogs[0].eventType} / {account.metaConnectionLogs[0].message}
                                </p>
                              ) : null}
                              {account.webhookLogs[0] ? (
                                <p className="text-xs text-muted-foreground">
                                  Webhook: {account.webhookLogs[0].status}
                                  {account.webhookLogs[0].errorMessage ? ` / ${account.webhookLogs[0].errorMessage}` : ""}
                                </p>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground">No WhatsApp accounts connected for this business.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Business details, subscriptions, invoices, payments, and members appear here.</p>
                  )}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {!loading && active === "users" ? <SimpleTable title="Users" rows={users.map((u) => [u.email, u.name ?? "No name", u.isSuperAdmin ? "SUPER_ADMIN" : `${u.tenants.length} tenants`, formatDate(u.createdAt)])} /> : null}
          {!loading && active === "plans" ? <SimpleTable title="Plans" rows={plans.map((p) => [p.name, p.code, money(p.priceMonthly, p.currency), p.isActive ? "Active" : "Inactive"])} /> : null}
          {!loading && active === "subscriptions" ? <SimpleTable title="Subscriptions" rows={subscriptions.map((s) => [s.tenant.name, s.plan, s.status, formatDate(s.currentPeriodEnd)])} /> : null}
          {!loading && active === "billing" && billing ? <BillingSection billing={billing} /> : null}
          {!loading && active === "usage" ? <SimpleTable title="Usage overview" rows={usage.map((u) => [u.tenant.name, `${formatNumber(u.aiRepliesUsedThisMonth)} AI`, `${formatNumber(u.whatsappMessagesUsedThisMonth)} WhatsApp`, `${u.storageMb} MB`, `${u.campaignRecipients} campaign recipients`])} /> : null}
          {!loading && active === "audit" ? <SimpleTable title="Audit logs" rows={auditLogs.map((log) => [log.tenant?.name ?? "Platform", log.actor?.email ?? "System", log.action, log.entityType, formatDate(log.createdAt)])} /> : null}
          {!loading && active === "health" && health ? <HealthSection health={health} /> : null}
          {!loading && active === "settings" && settings ? (
            <SettingsSection settings={settings} setSettings={setSettings} updateFlags={updateFlags} createAnnouncement={createAnnouncement} />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function SimpleTable({ title, rows }: { title: string; rows: Array<Array<string | number>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Platform-owner read model.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.length ? rows.map((row, index) => (
                <tr key={index} className="border-t first:border-t-0">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="py-3 pr-4">{cell}</td>)}
                </tr>
              )) : (
                <tr><td className="py-8 text-center text-muted-foreground">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function BillingSection({ billing }: { billing: BillingData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SimpleTable title="Invoices" rows={billing.invoices.items.map((invoice) => [invoice.tenant.name, invoice.number, invoice.status, money(invoice.total, invoice.currency), formatDate(invoice.createdAt)])} />
      <SimpleTable title="Payments" rows={billing.payments.items.map((payment) => [payment.tenant.name, payment.status, money(payment.amount, payment.currency), payment.provider ?? "manual", formatDate(payment.createdAt)])} />
    </div>
  );
}

function HealthSection({ health }: { health: SystemHealth }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System health</CardTitle>
        <CardDescription>Database, queue, and platform health snapshot.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <StatCard title="Status" value={health.status} detail={`Checked ${formatDate(health.checkedAt)}`} icon={HeartPulse} />
        <StatCard title="Database" value={health.database} detail="Prisma query succeeded" icon={Activity} />
        <StatCard title="Queues" value={health.queues.length.toString()} detail={health.queues.join(", ")} icon={Bell} />
      </CardContent>
    </Card>
  );
}

function SettingsSection({
  settings,
  setSettings,
  updateFlags,
  createAnnouncement
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData | null>>;
  updateFlags: () => Promise<void>;
  createAnnouncement: () => Promise<void>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
          <CardDescription>Placeholder runtime flags for platform features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(settings.featureFlags).map(([key, value]) => (
            <label key={key} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{key}</span>
              <input
                type="checkbox"
                checked={value}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, featureFlags: { ...current.featureFlags, [key]: event.target.checked } }
                      : current
                  )
                }
              />
            </label>
          ))}
          <Button onClick={() => void updateFlags()}>Save flags</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Announcements and support</CardTitle>
          <CardDescription>Support tickets and announcements are placeholders in this phase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 text-sm text-muted-foreground">Support tickets: {settings.supportTickets.length}</div>
          <div className="rounded-md border p-3 text-sm text-muted-foreground">Announcements: {settings.announcements.length}</div>
          <Button variant="outline" onClick={() => void createAnnouncement()}>Create placeholder announcement</Button>
        </CardContent>
      </Card>
    </div>
  );
}

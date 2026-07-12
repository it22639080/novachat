"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  StopCircle,
  Upload,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ApiClientError, apiClient } from "@/lib/api-client";

type Paginated<T> = { items: T[]; pagination: { total: number } };

type Campaign = {
  id: string;
  whatsappAccountId: string | null;
  name: string;
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";
  audience: Record<string, unknown>;
  templateName: string | null;
  scheduledAt: string | null;
  recipientStats: {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    optedOut: number;
  };
  updatedAt: string;
};

type Template = {
  id: string;
  name: string;
  languageCode: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  bodyText: string;
};

type WhatsAppAccount = {
  id: string;
  displayName: string | null;
  displayPhoneNumber: string;
  status: string;
};

type Customer = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  status: string;
  customFields: Record<string, unknown> | null;
};

const defaultTemplate = {
  name: "festival_offer",
  languageCode: "en_US",
  category: "MARKETING",
  status: "APPROVED",
  bodyText: "Hi {{1}}, our latest offer is now available. Reply STOP to opt out."
};

const defaultCampaign = {
  name: "July WhatsApp campaign",
  templateId: "",
  whatsappAccountId: "",
  audienceSource: "SEGMENT",
  automationType: "ONE_TIME",
  csv: "",
  scheduleAt: ""
};

function statusVariant(status: Campaign["status"] | Template["status"]) {
  if (status === "COMPLETED" || status === "APPROVED") return "success";
  if (status === "FAILED" || status === "REJECTED" || status === "CANCELLED") return "warning";
  return "neutral";
}

function errorText(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Something went wrong. Please try again.";
}

function isOptedIn(customer: Customer) {
  const fields = customer.customFields ?? {};
  return fields.whatsappOptIn === true || fields.marketingOptIn === true || fields.optIn === true;
}

function isOptedOut(customer: Customer) {
  const fields = customer.customFields ?? {};
  return fields.whatsappOptOut === true || fields.marketingOptOut === true || fields.unsubscribed === true;
}

type StatItem = [string, number, LucideIcon];

export default function CampaignsPage() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id;
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [accounts, setAccounts] = React.useState<WhatsAppAccount[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [templateForm, setTemplateForm] = React.useState(defaultTemplate);
  const [campaignForm, setCampaignForm] = React.useState(defaultCampaign);
  const [selectedCampaign, setSelectedCampaign] = React.useState<Campaign | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    if (!tenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [campaignResult, templateResult, accountResult, customerResult] = await Promise.all([
        apiClient.get<Paginated<Campaign>>("/campaigns?page=1&pageSize=50&sortBy=createdAt&sortDirection=desc", { tenantId }),
        apiClient.get<Paginated<Template>>("/templates?page=1&pageSize=50&sortBy=createdAt&sortDirection=desc", { tenantId }),
        apiClient.get<WhatsAppAccount[]>("/whatsapp/accounts", { tenantId }),
        apiClient.get<Paginated<Customer>>("/customers?page=1&pageSize=20&status=ACTIVE&sortBy=createdAt&sortDirection=desc", { tenantId })
      ]);
      setCampaigns(campaignResult.items);
      setTemplates(templateResult.items);
      setAccounts(accountResult.filter((account) => account.status === "CONNECTED"));
      setCustomers(customerResult.items);
      setSelectedCampaign(campaignResult.items[0] ?? null);
      setNotice(null);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    try {
      await apiClient.post("/templates", templateForm, { tenantId });
      setNotice("Template saved. Make sure this template is approved in Meta before live campaign use.");
      await loadData();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    const template = templates.find((item) => item.id === campaignForm.templateId);
    if (!template) {
      setNotice("Select an approved WhatsApp template first.");
      return;
    }

    setSaving(true);
    try {
      const campaign = await apiClient.post<Campaign>(
        "/campaigns",
        {
          name: campaignForm.name,
          whatsappAccountId: campaignForm.whatsappAccountId || undefined,
          templateId: template.id,
          templateName: template.name,
          languageCode: template.languageCode,
          status: "DRAFT",
          audience: {
            source: campaignForm.audienceSource,
            csv: campaignForm.csv || undefined,
            optInOnly: true,
            excludeOptedOut: true,
            automationType: campaignForm.automationType
          }
        },
        { tenantId }
      );
      setCampaignForm(defaultCampaign);
      setSelectedCampaign(campaign);
      setNotice("Campaign draft created with opted-in recipients only.");
      await loadData();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function scheduleCampaign() {
    if (!tenantId || !selectedCampaign || !campaignForm.scheduleAt) return;
    setSaving(true);
    try {
      await apiClient.post(`/campaigns/${selectedCampaign.id}/schedule`, { scheduledAt: campaignForm.scheduleAt }, { tenantId });
      setNotice("Campaign scheduled. Start the worker to process scheduled sends.");
      await loadData();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function sendNow(campaign: Campaign) {
    if (!tenantId) return;
    setSaving(true);
    try {
      await apiClient.post(`/campaigns/${campaign.id}/send-now`, undefined, { tenantId });
      setNotice("Campaign queued. Run the worker to send queued WhatsApp template messages.");
      await loadData();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function stopCampaign(campaign: Campaign) {
    if (!tenantId) return;
    setSaving(true);
    try {
      await apiClient.post(`/campaigns/${campaign.id}/stop`, undefined, { tenantId });
      setNotice("Campaign stopped.");
      await loadData();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function setOptIn(customer: Customer, optedIn: boolean) {
    if (!tenantId) return;
    setSaving(true);
    try {
      await apiClient.patch(
        `/customers/${customer.id}`,
        {
          customFields: {
            ...(customer.customFields ?? {}),
            whatsappOptIn: optedIn,
            marketingOptIn: optedIn,
            whatsappOptOut: !optedIn,
            marketingOptOut: !optedIn
          }
        },
        { tenantId }
      );
      await loadData();
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
          <Badge variant="neutral" className="mb-3">Official WhatsApp only</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Build compliant WhatsApp template campaigns, segment opted-in audiences, schedule sends, and track delivery health.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </motion.div>

      {notice ? <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

      <div className="grid gap-3 lg:grid-cols-4">
        {([
          ["Templates", templates.length, ShieldCheck],
          ["Campaigns", campaigns.length, Megaphone],
          ["Opted-in contacts", customers.filter(isOptedIn).length, UsersRound],
          ["Queued recipients", campaigns.reduce((sum, item) => sum + item.recipientStats.pending, 0), Send]
        ] satisfies StatItem[]).map(([label, value, Icon]) => (
          <Card key={String(label)}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold">{String(value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <Skeleton className="h-[560px]" />
          <Skeleton className="h-[560px]" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Campaign list</CardTitle>
                <CardDescription>Schedule, stop, and monitor tenant campaigns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaigns.length ? campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedCampaign(campaign)}
                    className={`w-full rounded-lg border p-4 text-left transition hover:bg-muted ${selectedCampaign?.id === campaign.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{campaign.name}</p>
                          <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                          {campaign.templateName ? <Badge variant="neutral">{campaign.templateName}</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {campaign.recipientStats.total} recipients · {campaign.recipientStats.sent} sent · {campaign.recipientStats.failed} failed
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); void sendNow(campaign); }} disabled={saving || campaign.status === "RUNNING"}>
                          <Send className="h-4 w-4" /> Send
                        </Button>
                        <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); void stopCampaign(campaign); }} disabled={saving || !["SCHEDULED", "RUNNING", "PAUSED"].includes(campaign.status)}>
                          <StopCircle className="h-4 w-4" /> Stop
                        </Button>
                      </div>
                    </div>
                  </button>
                )) : (
                  <EmptyState icon={Megaphone} title="No campaigns yet" description="Create an approved template and campaign draft to begin." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opt-in management</CardTitle>
                <CardDescription>Campaigns only include opted-in customers and exclude opted-out contacts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {customers.map((customer) => (
                  <div key={customer.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{customer.name ?? customer.phone}</p>
                      <p className="text-sm text-muted-foreground">{customer.phone} {customer.email ? `· ${customer.email}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isOptedIn(customer) ? "success" : isOptedOut(customer) ? "warning" : "neutral"}>
                        {isOptedIn(customer) ? "Opted in" : isOptedOut(customer) ? "Opted out" : "Unknown"}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => void setOptIn(customer, true)} disabled={saving}>Opt in</Button>
                      <Button size="sm" variant="outline" onClick={() => void setOptIn(customer, false)} disabled={saving}>Opt out</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Compliance checklist</CardTitle>
                <CardDescription>Guardrails for official WhatsApp Business Platform campaigns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  "Use only approved Meta WhatsApp templates.",
                  "Send marketing only to customers with opt-in proof.",
                  "Exclude customers who replied STOP or opted out.",
                  "Use template messages outside the 24-hour service window.",
                  "Run worker and respect queue/rate limits for campaign sends."
                ].map((item) => (
                  <div key={item} className="flex gap-2 rounded-md border p-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Template management</CardTitle>
                <CardDescription>Mirror approved Meta templates for tenant campaign selection.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(event) => void createTemplate(event)}>
                  <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} placeholder="template_name" />
                  <div className="grid grid-cols-2 gap-2">
                    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={templateForm.category} onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))}>
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={templateForm.status} onChange={(event) => setTemplateForm((current) => ({ ...current, status: event.target.value }))}>
                      <option value="APPROVED">Approved</option>
                      <option value="PENDING">Pending</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                  <textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" value={templateForm.bodyText} onChange={(event) => setTemplateForm((current) => ({ ...current, bodyText: event.target.value }))} />
                  <Button className="w-full" disabled={saving}>
                    <Plus className="h-4 w-4" /> Save template
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaign builder</CardTitle>
                <CardDescription>Create a recipient set from opted-in contacts or CSV import.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(event) => void createCampaign(event)}>
                  <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={campaignForm.name} onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))} placeholder="Campaign name" />
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={campaignForm.templateId} onChange={(event) => setCampaignForm((current) => ({ ...current, templateId: event.target.value }))}>
                    <option value="">Select approved template</option>
                    {templates.filter((template) => template.status === "APPROVED").map((template) => <option key={template.id} value={template.id}>{template.name} · {template.languageCode}</option>)}
                  </select>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={campaignForm.whatsappAccountId} onChange={(event) => setCampaignForm((current) => ({ ...current, whatsappAccountId: event.target.value }))}>
                    <option value="">Use latest connected WhatsApp account</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName ?? account.displayPhoneNumber}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={campaignForm.audienceSource} onChange={(event) => setCampaignForm((current) => ({ ...current, audienceSource: event.target.value }))}>
                      <option value="SEGMENT">Active opted-in segment</option>
                      <option value="ALL_CUSTOMERS">All opted-in customers</option>
                      <option value="CSV">CSV recipients</option>
                    </select>
                    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={campaignForm.automationType} onChange={(event) => setCampaignForm((current) => ({ ...current, automationType: event.target.value }))}>
                      <option value="ONE_TIME">One-time</option>
                      <option value="BIRTHDAY">Birthday</option>
                      <option value="FESTIVAL">Festival</option>
                      <option value="ABANDONED_CART">Abandoned cart</option>
                      <option value="FOLLOW_UP">Follow-up</option>
                    </select>
                  </div>
                  <textarea className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm" value={campaignForm.csv} onChange={(event) => setCampaignForm((current) => ({ ...current, csv: event.target.value }))} placeholder="CSV import: phone,name" />
                  <Button className="w-full" disabled={saving}>
                    <Upload className="h-4 w-4" /> Create draft campaign
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule and analytics</CardTitle>
                <CardDescription>{selectedCampaign ? selectedCampaign.name : "Select a campaign to inspect."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedCampaign ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Total</p><p className="font-semibold">{selectedCampaign.recipientStats.total}</p></div>
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Sent</p><p className="font-semibold">{selectedCampaign.recipientStats.sent}</p></div>
                      <div className="rounded-md border p-2"><p className="text-muted-foreground">Failed</p><p className="font-semibold">{selectedCampaign.recipientStats.failed}</p></div>
                    </div>
                    <input type="datetime-local" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={campaignForm.scheduleAt} onChange={(event) => setCampaignForm((current) => ({ ...current, scheduleAt: event.target.value }))} />
                    <Button className="w-full" variant="outline" onClick={() => void scheduleCampaign()} disabled={saving || !campaignForm.scheduleAt}>
                      <CalendarClock className="h-4 w-4" /> Schedule selected campaign
                    </Button>
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="mr-2 inline h-4 w-4" />
                      Opt-in and opt-out filters are applied before recipients are created.
                    </div>
                  </>
                ) : (
                  <EmptyState icon={Megaphone} title="No campaign selected" description="Create or select a campaign to see analytics." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

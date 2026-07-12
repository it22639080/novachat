"use client";

import * as React from "react";
import { CheckCircle2, EyeOff, Globe2, Link2, MessageSquareText, Plus, RefreshCw, Send, ShieldCheck, Unlink } from "lucide-react";
import { motion } from "framer-motion";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useAuth } from "@/components/auth/auth-provider";
import { apiClient, ApiClientError } from "@/lib/api-client";

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; version: string; xfbml?: boolean; cookie?: boolean }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type FacebookLoginResponse = {
  status?: string;
  authResponse?: {
    code?: string;
    accessToken?: string;
    expiresIn?: number;
  };
};

type WhatsAppAccount = {
  id: string;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  displayName: string | null;
  verifiedName?: string | null;
  qualityRating?: string | null;
  onboardingMethod?: string;
  status: string;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  lastHealthCheckAt?: string | null;
  lastWebhookAt?: string | null;
  setupErrors?: unknown;
  hasAccessToken: boolean;
  maskedAccessToken: string | null;
  webhookVerifyToken: string | null;
  lastWebhook: {
    messageId: string;
    receivedAt: string;
    payload: unknown;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type MetaConfig = {
  appId: string | null;
  configId: string | null;
  apiVersion: string;
  redirectUri: string | null;
  embeddedSignupEnabled: boolean;
};

type MetaHealth = {
  ready: boolean;
  status: string;
  checklist: Array<{ key: string; label: string; ok: boolean; detail?: string }>;
};

type MetaStatus = {
  status: string;
  account: WhatsAppAccount | null;
  latestLog: { eventType: string; status: string; message: string; createdAt: string } | null;
};

type WebhookLog = {
  id: string;
  phoneNumberId: string | null;
  status: "RECEIVED" | "PROCESSED" | "FAILED" | "IGNORED";
  errorMessage: string | null;
  account: {
    id: string;
    displayName: string | null;
    displayPhoneNumber: string;
    phoneNumberId: string;
  } | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseRecord(parsed);
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function loadFacebookSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }

    const existing = document.getElementById("facebook-jssdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Facebook SDK failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Facebook SDK failed to load."));
    document.body.appendChild(script);
  });
}

export default function SettingsPage() {
  const { activeTenant } = useAuth();
  const tenantOptions = activeTenant?.id ? { tenantId: activeTenant.id } : {};
  const [activeTab, setActiveTab] = React.useState<"automatic" | "manual">("automatic");
  const [accounts, setAccounts] = React.useState<WhatsAppAccount[]>([]);
  const [metaConfig, setMetaConfig] = React.useState<MetaConfig | null>(null);
  const [metaStatus, setMetaStatus] = React.useState<MetaStatus | null>(null);
  const [webhookLogs, setWebhookLogs] = React.useState<WebhookLog[]>([]);
  const [health, setHealth] = React.useState<MetaHealth | null>(null);
  const [selectedAccountId, setSelectedAccountId] = React.useState("");
  const [businessAccountId, setBusinessAccountId] = React.useState("");
  const [phoneNumberId, setPhoneNumberId] = React.useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [accessToken, setAccessToken] = React.useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = React.useState("");
  const [testPhone, setTestPhone] = React.useState("");
  const [testMessage, setTestMessage] = React.useState("NovaChat AI WhatsApp test message");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const signupMessageRef = React.useRef<Record<string, unknown> | null>(null);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? metaStatus?.account ?? accounts[0];
  const webhookUrl = "https://YOUR_API_DOMAIN.com/api/v1/webhooks/whatsapp";

  React.useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>) {
      const origin = event.origin.toLowerCase();
      if (!origin.includes("facebook.com")) return;
      const data = parseRecord(event.data);
      if (data) {
        signupMessageRef.current = data;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function loadSettings() {
    if (!activeTenant?.id) {
      setLoading(false);
      setError("Tenant/business not selected. Please select or create a business first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextAccounts, config, status, logs] = await Promise.all([
        apiClient.get<WhatsAppAccount[]>("/whatsapp/accounts", tenantOptions),
        apiClient.get<MetaConfig>("/meta/embedded-signup/config", tenantOptions),
        apiClient.get<MetaStatus>("/meta/embedded-signup/status", tenantOptions),
        apiClient.get<WebhookLog[]>("/whatsapp/webhook-logs", tenantOptions)
      ]);
      setAccounts(nextAccounts);
      setMetaConfig(config);
      setMetaStatus(status);
      setWebhookLogs(logs);
      setSelectedAccountId((current) => current || status.account?.id || nextAccounts[0]?.id || "");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadSettings();
  }, [activeTenant?.id]);

  async function connectAutomatically() {
    if (!activeTenant?.id) {
      setError("Tenant/business not selected. Please select or create a business first.");
      return;
    }
    if (!metaConfig?.embeddedSignupEnabled || !metaConfig.appId || !metaConfig.configId) {
      setError("Meta Embedded Signup is not configured yet. Ask the platform admin to configure Meta App settings.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice("Opening Meta Embedded Signup...");

    try {
      await loadFacebookSdk();
      if (!window.FB) throw new Error("Facebook SDK is unavailable.");

      window.FB.init({
        appId: metaConfig.appId,
        version: metaConfig.apiVersion,
        xfbml: false,
        cookie: false
      });

      const response = await new Promise<FacebookLoginResponse>((resolve) => {
        window.FB?.login(resolve, {
          config_id: metaConfig.configId,
          response_type: "token",
          extras: {
            setup: {},
            sessionInfoVersion: "3"
          }
        });
      });

      if (!response.authResponse?.code && !response.authResponse?.accessToken) {
        setNotice(null);
        setError("WhatsApp connection was cancelled or Meta did not return authorization data.");
        return;
      }

      const expiresIn = response.authResponse.expiresIn;
      const callbackPayload = {
        ...(response.authResponse.code ? { code: response.authResponse.code } : {}),
        ...(response.authResponse.accessToken ? { accessToken: response.authResponse.accessToken } : {}),
        ...(typeof expiresIn === "number" && expiresIn > 0 ? { expiresIn } : {}),
        rawResult: {
          facebookLogin: response,
          embeddedSignup: signupMessageRef.current
        }
      };

      const callback = await apiClient.post<{ account: WhatsAppAccount }>("/meta/embedded-signup/callback", {
        ...callbackPayload
      }, tenantOptions);

      const completed = await apiClient.post<{ account: WhatsAppAccount; health: MetaHealth }>(
        "/meta/embedded-signup/complete",
        { accountId: callback.account.id },
        tenantOptions
      );

      setHealth(completed.health);
      setSelectedAccountId(callback.account.id);
      setNotice(completed.health.ready ? "WhatsApp connected successfully." : "WhatsApp saved, but setup needs review.");
      await loadSettings();
    } catch (connectError) {
      setError(errorMessage(connectError));
      setNotice(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAccount() {
    if (!activeTenant?.id) {
      setError("Tenant/business not selected. Please select or create a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const account = await apiClient.post<WhatsAppAccount>("/whatsapp/accounts", {
        businessAccountId,
        phoneNumberId,
        displayPhoneNumber,
        displayName: displayName || undefined,
        accessToken,
        webhookVerifyToken
      }, tenantOptions);

      setSelectedAccountId(account.id);
      setNotice("WhatsApp account saved. Access token is encrypted and will not be shown again.");
      setAccessToken("");
      await loadSettings();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendTestMessage() {
    const accountId = selectedAccount?.id;
    if (!accountId) {
      setError("Connect a WhatsApp account before sending a test message.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await apiClient.post<{ providerMessageId?: string }>("/whatsapp/send-text", {
        accountId,
        to: testPhone,
        text: testMessage
      }, tenantOptions);

      setNotice(`Test message queued with provider id ${result.providerMessageId ?? "pending"}.`);
      await loadSettings();
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSubmitting(false);
    }
  }

  async function runHealthCheck() {
    const accountId = selectedAccount?.id;
    if (!accountId) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.post<MetaHealth>("/meta/embedded-signup/health-check", { accountId }, tenantOptions);
      setHealth(result);
      setNotice(result.ready ? "Connection health check passed." : "Connection health check needs review.");
      await loadSettings();
    } catch (healthError) {
      setError(errorMessage(healthError));
    } finally {
      setSubmitting(false);
    }
  }

  async function disconnectAccount() {
    const accountId = selectedAccount?.id;
    if (!accountId) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/meta/embedded-signup/disconnect", { accountId, reason: "Disconnected by tenant admin" }, tenantOptions);
      setNotice("WhatsApp account disconnected. Message history is retained.");
      await loadSettings();
    } catch (disconnectError) {
      setError(errorMessage(disconnectError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="WhatsApp Integration"
        description="Connect official Meta WhatsApp Business Platform accounts with one-click onboarding or advanced manual setup."
        action={
          <Button type="button" variant="outline" onClick={loadSettings} disabled={loading || submitting}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
        meta={
          <>
            <StatusBadge tone="success">Official Cloud API only</StatusBadge>
            <StatusBadge tone="info">Tokens encrypted</StatusBadge>
          </>
        }
      />

      {error ? <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div> : null}

      <div className="inline-flex rounded-lg border bg-card p-1">
        {[
          ["automatic", "Connect Automatically"],
          ["manual", "Manual Setup"]
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as "automatic" | "manual")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "automatic" ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <Card>
            <CardHeader>
              <CardTitle>One-click WhatsApp onboarding</CardTitle>
              <CardDescription>Clients connect through Meta Embedded Signup. NovaChat stores tokens encrypted on the backend only.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-background p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">Meta Embedded Signup</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {metaConfig?.embeddedSignupEnabled ? "Configured and ready for client onboarding." : "Waiting for Meta app configuration."}
                    </p>
                  </div>
                  <Button type="button" onClick={connectAutomatically} disabled={submitting || loading || !metaConfig?.embeddedSignupEnabled}>
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    Connect WhatsApp
                  </Button>
                </div>
              </div>

              {metaStatus?.account ? (
                <div className="rounded-lg border bg-background p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold">{metaStatus.account.displayName ?? metaStatus.account.displayPhoneNumber}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Phone {metaStatus.account.displayPhoneNumber} / ID {metaStatus.account.phoneNumberId}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Onboarding: {metaStatus.account.onboardingMethod ?? "MANUAL"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Last webhook: {metaStatus.account.lastWebhookAt ? new Date(metaStatus.account.lastWebhookAt).toLocaleString() : "Not received yet"}</p>
                    </div>
                    <StatusBadge tone={metaStatus.account.status === "CONNECTED" ? "success" : "warning"}>{metaStatus.account.status}</StatusBadge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={runHealthCheck} disabled={submitting}>
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Health check
                    </Button>
                    <Button type="button" variant="outline" onClick={disconnectAccount} disabled={submitting}>
                      <Unlink className="h-4 w-4" aria-hidden="true" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">No automatic WhatsApp connection yet.</div>
              )}
            </CardContent>
          </Card>

          <ChecklistCard health={health} metaStatus={metaStatus} />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <Card>
            <CardHeader>
              <CardTitle>Manual WhatsApp account setup</CardTitle>
              <CardDescription>Advanced fallback for teams that already have Phone Number ID, WABA ID, and a Meta access token.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <ManualInput label="Business Account ID" value={businessAccountId} onChange={setBusinessAccountId} />
              <ManualInput label="Phone Number ID" value={phoneNumberId} onChange={setPhoneNumberId} />
              <ManualInput label="Display Phone Number" value={displayPhoneNumber} onChange={setDisplayPhoneNumber} />
              <ManualInput label="Display Name" value={displayName} onChange={setDisplayName} />
              <ManualInput label="Access Token" value={accessToken} onChange={setAccessToken} type="password" wide />
              <ManualInput label="Webhook Verify Token" value={webhookVerifyToken} onChange={setWebhookVerifyToken} wide />
              <div className="md:col-span-2">
                <Button type="button" onClick={saveAccount} disabled={submitting}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Save account
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual setup checklist</CardTitle>
              <CardDescription>Use these values in the Meta developer console.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {["Create or select a Meta Business app", "Add WhatsApp product and phone number", "Subscribe webhook fields for messages", "Paste callback URL and verify token", "Send a test message after verification"].map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border bg-background p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
              <div className="rounded-lg border bg-background p-3 text-sm">
                <p className="font-medium">Webhook callback URL</p>
                <p className="mt-1 break-all text-muted-foreground">{webhookUrl}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <ConnectedAccounts accounts={accounts} selectedAccountId={selectedAccount?.id} onSelect={setSelectedAccountId} />
        <TestSendCard testPhone={testPhone} setTestPhone={setTestPhone} testMessage={testMessage} setTestMessage={setTestMessage} sendTestMessage={sendTestMessage} submitting={submitting} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last webhook received</CardTitle>
          <CardDescription>Webhook payloads are stored for debugging without exposing access tokens.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedAccount?.lastWebhook ? (
            <div className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Message {selectedAccount.lastWebhook.messageId}</span>
                <StatusBadge tone="info">{new Date(selectedAccount.lastWebhook.receivedAt).toLocaleString()}</StatusBadge>
              </div>
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">{JSON.stringify(selectedAccount.lastWebhook.payload, null, 2)}</pre>
            </div>
          ) : (
            <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
              <MessageSquareText className="mb-3 h-5 w-5" aria-hidden="true" />
              Webhook debug data will appear here after Meta sends message or status webhooks.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent webhook logs</CardTitle>
          <CardDescription>Tenant-scoped Meta webhook events for setup verification and debugging.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {webhookLogs.length ? (
            webhookLogs.map((log) => (
              <details key={log.id} className="rounded-lg border bg-background p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{log.account?.displayName ?? log.account?.displayPhoneNumber ?? log.phoneNumberId ?? "Unknown phone number"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {log.phoneNumberId ?? "No phone_number_id"} / {new Date(log.createdAt).toLocaleString()}
                      </p>
                      {log.errorMessage ? <p className="mt-1 text-sm text-rose-600 dark:text-rose-300">{log.errorMessage}</p> : null}
                    </div>
                    <StatusBadge tone={log.status === "PROCESSED" ? "success" : log.status === "FAILED" ? "warning" : "info"}>{log.status}</StatusBadge>
                  </div>
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">{JSON.stringify(log.payload, null, 2)}</pre>
              </details>
            ))
          ) : (
            <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
              No webhook events have been received for this tenant yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManualInput({ label, value, onChange, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; wide?: boolean }) {
  return (
    <label className={`block text-sm ${wide ? "md:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring/20" />
    </label>
  );
}

function ChecklistCard({ health, metaStatus }: { health: MetaHealth | null; metaStatus: MetaStatus | null }) {
  const checklist = health?.checklist ?? [
    { key: "meta_app", label: "Meta app configured", ok: Boolean(metaStatus) },
    { key: "business", label: "Business selected", ok: Boolean(metaStatus?.account) },
    { key: "number", label: "WhatsApp number connected", ok: metaStatus?.status === "connected" },
    { key: "token", label: "Token saved securely", ok: Boolean(metaStatus?.account) },
    { key: "webhook", label: "Webhook verified", ok: Boolean(metaStatus?.account?.lastWebhookAt) },
    { key: "test", label: "Test message successful", ok: false },
    { key: "ai", label: "AI assistant configured", ok: false },
    { key: "knowledge", label: "Knowledge base added", ok: false },
    { key: "auto_reply", label: "AI auto-reply enabled", ok: false }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding checklist</CardTitle>
        <CardDescription>Track the steps needed before live AI automation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {checklist.map((item) => (
          <div key={item.key} className="flex gap-3 rounded-lg border bg-background p-3 text-sm">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.ok ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground"}`} />
            <div>
              <p>{item.label}</p>
              {"detail" in item && item.detail ? <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p> : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConnectedAccounts({ accounts, selectedAccountId, onSelect }: { accounts: WhatsAppAccount[]; selectedAccountId: string | undefined; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>Tokens are masked after save. Manual and Embedded Signup accounts can coexist.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.length ? accounts.map((account) => (
          <button key={account.id} type="button" onClick={() => onSelect(account.id)} className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent ${selectedAccountId === account.id ? "bg-accent" : "bg-background"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{account.displayName ?? account.displayPhoneNumber}</p>
                <p className="mt-1 text-sm text-muted-foreground">Phone ID {account.phoneNumberId} / Business {account.businessAccountId}</p>
                <p className="mt-1 text-sm text-muted-foreground">{account.onboardingMethod ?? "MANUAL"} / {account.qualityRating ?? "quality pending"}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  {account.maskedAccessToken ?? "No token"}
                </div>
              </div>
              <StatusBadge tone={account.status === "CONNECTED" ? "success" : "warning"}>{account.status}</StatusBadge>
            </div>
          </button>
        )) : (
          <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
            <Globe2 className="mb-3 h-5 w-5" />
            No WhatsApp accounts connected yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TestSendCard({ testPhone, setTestPhone, testMessage, setTestMessage, sendTestMessage, submitting }: { testPhone: string; setTestPhone: (value: string) => void; testMessage: string; setTestMessage: (value: string) => void; sendTestMessage: () => Promise<void>; submitting: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Test send</CardTitle>
        <CardDescription>Sends a real text message through the selected Cloud API account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ManualInput label="Recipient phone" value={testPhone} onChange={setTestPhone} />
        <label className="block text-sm">
          <span className="font-medium">Message</span>
          <textarea rows={4} value={testMessage} onChange={(event) => setTestMessage(event.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring/20" />
        </label>
        <Button type="button" className="w-full" onClick={() => void sendTestMessage()} disabled={submitting}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Send test message
        </Button>
      </CardContent>
    </Card>
  );
}

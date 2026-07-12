"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Brain,
  Languages,
  MessageSquareText,
  Power,
  RefreshCw,
  Save,
  Send,
  ShieldCheck
} from "lucide-react";
import { Badge, Button, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiClientError, apiClient } from "@/lib/api-client";

type AiSettings = {
  isEnabled: boolean;
  provider: "OPENAI" | "GEMINI";
  modelName: string;
  temperature: number;
  businessName: string | null;
  businessDescription: string | null;
  tone: "friendly" | "professional" | "concise" | "warm" | "playful";
  supportedLanguages: string[];
  openingHours: unknown;
  services: string[];
  policies: string[];
  fallbackMessage: string;
  handoverKeywords: string[];
};

type AiLog = {
  id: string;
  provider: string;
  modelName: string;
  promptTokens: number;
  outputTokens: number;
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  latencyMs: number | null;
  error: string | null;
  conversation: { id: string; subject: string | null } | null;
  createdAt: string;
};

type PaginatedResult<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const defaultSettings: AiSettings = {
  isEnabled: false,
  provider: "OPENAI",
  modelName: "gpt-4o-mini",
  temperature: 0.2,
  businessName: "",
  businessDescription: "",
  tone: "friendly",
  supportedLanguages: ["English"],
  openingHours: {},
  services: [],
  policies: [],
  fallbackMessage: "Thanks for your message. A team member will get back to you shortly.",
  handoverKeywords: ["human", "agent", "support", "representative"]
};

function toLines(value: string[]) {
  return value.join("\n");
}

function fromLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function nullableText(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

function cleanSettingsPayload(settings: AiSettings) {
  return {
    ...settings,
    businessName: nullableText(settings.businessName),
    businessDescription: nullableText(settings.businessDescription),
    supportedLanguages: settings.supportedLanguages.map((item) => item.trim()).filter(Boolean),
    services: settings.services.map((item) => item.trim()).filter(Boolean),
    policies: settings.policies.map((item) => item.trim()).filter(Boolean),
    handoverKeywords: settings.handoverKeywords.map((item) => item.trim()).filter(Boolean),
    fallbackMessage: settings.fallbackMessage.trim()
  };
}

function withTenantId<TPayload extends object>(tenantId: string, payload: TPayload) {
  return {
    tenantId,
    ...payload
  };
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusVariant(status: AiLog["status"]) {
  if (status === "SUCCESS") {
    return "success";
  }

  if (status === "FAILED") {
    return "warning";
  }

  return "neutral";
}

export default function AiAssistantPage() {
  const { activeTenant } = useAuth();
  const currentTenantId = activeTenant?.id;
  const [settings, setSettings] = React.useState<AiSettings>(defaultSettings);
  const [logs, setLogs] = React.useState<AiLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("Hi, do you have delivery available today?");
  const [reply, setReply] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!currentTenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [settingsResult, logsResult] = await Promise.all([
        apiClient.get<AiSettings>("/ai/settings", { tenantId: currentTenantId }),
        apiClient.get<PaginatedResult<AiLog>>("/ai/logs?page=1&pageSize=20", {
          tenantId: currentTenantId
        })
      ]);
      setSettings(settingsResult);
      setLogs(logsResult.items);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error, "Could not load AI Assistant."));
    } finally {
      setLoading(false);
    }
  }, [currentTenantId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (!currentTenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      return;
    }

    setSaving(true);
    try {
      const saved = await apiClient.patch<AiSettings>(
        "/ai/settings",
        withTenantId(currentTenantId, cleanSettingsPayload(settings)),
        { tenantId: currentTenantId }
      );
      setSettings(saved);
      setNotice("AI settings saved.");
    } catch (error) {
      setNotice(errorMessage(error, "Could not save AI settings."));
    } finally {
      setSaving(false);
    }
  }

  async function testReply() {
    if (!currentTenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      return;
    }

    setReply(null);
    try {
      const result = await apiClient.post<{ reply: string; confidence: number; fallbackUsed: boolean }>(
        "/ai/test-reply",
        withTenantId(currentTenantId, {
          message,
          customerName: "Test Customer",
          customerPhone: "+15550100001"
        }),
        { tenantId: currentTenantId }
      );
      console.info("AI test reply response:", result);
      setReply(`${result.reply}\n\nConfidence placeholder: ${Math.round(result.confidence * 100)}%`);
      await load();
    } catch (error) {
      setNotice(errorMessage(error, "Could not generate a test reply."));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <Brain className="h-3.5 w-3.5" />
            Tenant AI Assistant
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the business profile, handover behavior, test replies, and inspect AI logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" onClick={() => void saveSettings()} disabled={saving}>
            <Save className="h-4 w-4" />
            Save settings
          </Button>
        </div>
      </div>

      {notice ? <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Skeleton className="h-[720px] rounded-lg" />
          <Skeleton className="h-[720px] rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Power className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Assistant settings</h2>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span>{settings.isEnabled ? "Enabled" : "Disabled"}</span>
                <input
                  type="checkbox"
                  checked={settings.isEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, isEnabled: event.target.checked }))
                  }
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Business name">
                <input
                  value={settings.businessName ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, businessName: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Tone">
                <select
                  value={settings.tone}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, tone: event.target.value as AiSettings["tone"] }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="concise">Concise</option>
                  <option value="warm">Warm</option>
                  <option value="playful">Playful</option>
                </select>
              </Field>
              <Field label="Provider">
                <select
                  value={settings.provider}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, provider: event.target.value as AiSettings["provider"] }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="OPENAI">OpenAI</option>
                  <option value="GEMINI">Gemini placeholder</option>
                </select>
              </Field>
              <Field label="Model">
                <input
                  value={settings.modelName}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, modelName: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                />
              </Field>
            </div>

            <Field label="Business description" className="mt-4">
              <textarea
                value={settings.businessDescription ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, businessDescription: event.target.value }))
                }
                className="min-h-28 w-full resize-none rounded-md border bg-background p-3 text-sm"
              />
            </Field>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Supported languages">
                <textarea
                  value={toLines(settings.supportedLanguages)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      supportedLanguages: fromLines(event.target.value)
                    }))
                  }
                  className="min-h-24 w-full resize-none rounded-md border bg-background p-3 text-sm"
                />
              </Field>
              <Field label="Handover keywords">
                <textarea
                  value={toLines(settings.handoverKeywords)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      handoverKeywords: fromLines(event.target.value)
                    }))
                  }
                  className="min-h-24 w-full resize-none rounded-md border bg-background p-3 text-sm"
                />
              </Field>
              <Field label="Services">
                <textarea
                  value={toLines(settings.services)}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, services: fromLines(event.target.value) }))
                  }
                  className="min-h-28 w-full resize-none rounded-md border bg-background p-3 text-sm"
                />
              </Field>
              <Field label="Policies">
                <textarea
                  value={toLines(settings.policies)}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, policies: fromLines(event.target.value) }))
                  }
                  className="min-h-28 w-full resize-none rounded-md border bg-background p-3 text-sm"
                />
              </Field>
            </div>

            <Field label="Fallback message" className="mt-4">
              <textarea
                value={settings.fallbackMessage}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, fallbackMessage: event.target.value }))
                }
                className="min-h-20 w-full resize-none rounded-md border bg-background p-3 text-sm"
              />
            </Field>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Test chat playground</h2>
              </div>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-4 min-h-28 w-full resize-none rounded-md border bg-background p-3 text-sm"
              />
              <Button type="button" className="mt-3 w-full" onClick={() => void testReply()}>
                <Send className="h-4 w-4" />
                Generate test reply
              </Button>
              {reply ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-6"
                >
                  {reply}
                </motion.div>
              ) : null}
            </section>

            <section className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Runtime behavior</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Replies use configured supported languages and tone.
                </div>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Simulator and WhatsApp use the same AI engine.
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">AI logs</h2>
          <Badge>{logs.length} recent</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.length ? (
                logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                      {log.error ? <p className="mt-1 text-xs text-muted-foreground">{log.error}</p> : null}
                    </td>
                    <td className="px-4 py-3">{log.provider}</td>
                    <td className="px-4 py-3">{log.modelName}</td>
                    <td className="px-4 py-3">
                      {log.promptTokens} in / {log.outputTokens} out
                    </td>
                    <td className="px-4 py-3">{log.latencyMs ?? 0}ms</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(log.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No AI logs yet. Generate a test reply or enable AI for incoming messages.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

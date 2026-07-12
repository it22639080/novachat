"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Brain,
  CheckCircle2,
  History,
  Languages,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  Wrench
} from "lucide-react";
import { Badge, Button, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiClientError, apiClient } from "@/lib/api-client";

type AgentStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
type AiProvider = "OPENAI" | "GEMINI";

type AgentTemplate = {
  key: string;
  name: string;
  description: string;
  personality: string;
  tone: string;
  toolPermissions: string[];
  allowedActions: string[];
  systemPrompt: string;
};

type AiAgent = {
  id: string;
  name: string;
  description: string | null;
  templateKey: string | null;
  status: AgentStatus;
  provider: AiProvider;
  modelName: string;
  temperature: number;
  personality: string;
  tone: string;
  supportedLanguages: string[];
  systemPrompt: string;
  customPrompt: string | null;
  toolPermissions: string[];
  allowedActions: string[];
  handoverRules: string[];
  knowledgeDocumentIds: string[];
  assignedWhatsappAccount: { id: string; displayName: string | null; displayPhoneNumber: string; status: string } | null;
  assignedChatbot: { id: string; name: string; status: string } | null;
  activeVersion: number;
  versions: Array<{ id: string; version: number; changelog: string | null; createdAt: string }>;
  updatedAt: string;
};

type KnowledgeDocument = {
  id: string;
  title: string;
  status: string;
  chunkCount: number;
};

type WhatsAppAccount = {
  id: string;
  displayName: string | null;
  displayPhoneNumber: string;
  status: string;
};

type Chatbot = {
  id: string;
  name: string;
  status: string;
};

type Paginated<T> = {
  items: T[];
  pagination: { total: number };
};

const toolOptions = [
  "search_knowledge",
  "search_products",
  "check_product_availability",
  "create_draft_order",
  "confirm_order",
  "get_order_status",
  "check_available_slots",
  "book_appointment",
  "reschedule_appointment",
  "handover_to_human"
];

function listToText(value: string[]) {
  return value.join("\n");
}

function textToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return `${fallback} ${error.message}`;
  }
  if (error instanceof Error) {
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

function cleanAgentPayload(agent: AiAgent) {
  return {
    name: agent.name.trim(),
    description: agent.description?.trim() || null,
    templateKey: agent.templateKey,
    status: agent.status,
    provider: agent.provider,
    modelName: agent.modelName.trim() || "gpt-4o-mini",
    temperature: agent.temperature,
    personality: agent.personality.trim() || "helpful",
    tone: agent.tone.trim() || "professional",
    supportedLanguages: agent.supportedLanguages.map((item) => item.trim()).filter(Boolean),
    systemPrompt: agent.systemPrompt.trim(),
    customPrompt: agent.customPrompt?.trim() || null,
    toolPermissions: agent.toolPermissions,
    allowedActions: agent.allowedActions.map((item) => item.trim()).filter(Boolean),
    handoverRules: agent.handoverRules.map((item) => item.trim()).filter(Boolean),
    knowledgeDocumentIds: agent.knowledgeDocumentIds,
    assignedWhatsappAccountId: agent.assignedWhatsappAccount?.id ?? null,
    assignedChatbotId: agent.assignedChatbot?.id ?? null
  };
}

function draftFromTemplate(template: AgentTemplate): Omit<AiAgent, "id" | "versions" | "updatedAt"> {
  return {
    name: template.name,
    description: template.description,
    templateKey: template.key,
    status: "DRAFT",
    provider: "OPENAI",
    modelName: "gpt-4o-mini",
    temperature: 0.2,
    personality: template.personality,
    tone: template.tone,
    supportedLanguages: ["English"],
    systemPrompt: template.systemPrompt,
    customPrompt: "",
    toolPermissions: template.toolPermissions,
    allowedActions: template.allowedActions,
    handoverRules: ["Escalate if the customer asks for a human.", "Escalate if confidence is low."],
    knowledgeDocumentIds: [],
    assignedWhatsappAccount: null,
    assignedChatbot: null,
    activeVersion: 1
  };
}

export default function AiAgentsPage() {
  const { activeTenant } = useAuth();
  const currentTenantId = activeTenant?.id;
  const [templates, setTemplates] = React.useState<AgentTemplate[]>([]);
  const [agents, setAgents] = React.useState<AiAgent[]>([]);
  const [documents, setDocuments] = React.useState<KnowledgeDocument[]>([]);
  const [whatsAppAccounts, setWhatsAppAccounts] = React.useState<WhatsAppAccount[]>([]);
  const [chatbots, setChatbots] = React.useState<Chatbot[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<AiAgent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [testMessage, setTestMessage] = React.useState("Hi, what can you help me with?");
  const [testReply, setTestReply] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!currentTenantId) {
      setNotice("Tenant/business not selected. Please select or create a business first.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [templateData, agentData, documentData, accountData, chatbotData] = await Promise.all([
        apiClient.get<AgentTemplate[]>("/ai-agents/templates", { tenantId: currentTenantId }),
        apiClient.get<Paginated<AiAgent>>("/ai-agents?page=1&pageSize=50", { tenantId: currentTenantId }),
        apiClient.get<Paginated<KnowledgeDocument>>("/knowledge/documents?page=1&pageSize=100", { tenantId: currentTenantId }),
        apiClient.get<WhatsAppAccount[]>("/whatsapp/accounts", { tenantId: currentTenantId }),
        apiClient.get<Paginated<Chatbot>>("/chatbots?page=1&pageSize=100", { tenantId: currentTenantId })
      ]);
      setTemplates(templateData);
      setAgents(agentData.items);
      setDocuments(documentData.items.filter((document) => document.status === "COMPLETED"));
      setWhatsAppAccounts(accountData);
      setChatbots(chatbotData.items);
      const nextSelectedId = selectedId ?? agentData.items[0]?.id ?? null;
      setSelectedId(nextSelectedId);
      setSelected(agentData.items.find((agent) => agent.id === nextSelectedId) ?? agentData.items[0] ?? null);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error, "Could not load AI Agent Builder."));
    } finally {
      setLoading(false);
    }
  }, [currentTenantId, selectedId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createFromTemplate(template: AgentTemplate) {
    if (!currentTenantId) return;
    setSaving(true);
    try {
      const draft = draftFromTemplate(template);
      const created = await apiClient.post<AiAgent>("/ai-agents", draft, { tenantId: currentTenantId });
      setAgents((current) => [created, ...current]);
      setSelectedId(created.id);
      setSelected(created);
      setNotice(`${created.name} created as a draft agent.`);
    } catch (error) {
      setNotice(errorMessage(error, "Could not create agent."));
    } finally {
      setSaving(false);
    }
  }

  async function saveAgent() {
    if (!currentTenantId || !selected) return;
    setSaving(true);
    try {
      const saved = await apiClient.patch<AiAgent>(`/ai-agents/${selected.id}`, cleanAgentPayload(selected), {
        tenantId: currentTenantId
      });
      setSelected(saved);
      setAgents((current) => current.map((agent) => (agent.id === saved.id ? saved : agent)));
      setNotice("Agent saved.");
    } catch (error) {
      setNotice(errorMessage(error, "Could not save agent."));
    } finally {
      setSaving(false);
    }
  }

  async function createVersion() {
    if (!currentTenantId || !selected) return;
    try {
      await apiClient.post(`/ai-agents/${selected.id}/versions`, { changelog: "Saved from Agent Builder" }, { tenantId: currentTenantId });
      const refreshed = await apiClient.get<AiAgent>(`/ai-agents/${selected.id}`, { tenantId: currentTenantId });
      setSelected(refreshed);
      setNotice("Version snapshot created.");
    } catch (error) {
      setNotice(errorMessage(error, "Could not create version."));
    }
  }

  async function setStatus(status: "activate" | "deactivate") {
    if (!currentTenantId || !selected) return;
    try {
      const updated = await apiClient.post<AiAgent>(`/ai-agents/${selected.id}/${status}`, undefined, {
        tenantId: currentTenantId
      });
      setSelected(updated);
      setAgents((current) => current.map((agent) => (agent.id === updated.id ? updated : agent)));
      setNotice(status === "activate" ? "Agent activated." : "Agent deactivated.");
    } catch (error) {
      setNotice(errorMessage(error, "Could not update agent status."));
    }
  }

  async function testAgent() {
    if (!currentTenantId || !selected) return;
    setTestReply(null);
    try {
      const result = await apiClient.post<{ reply: string; confidence: number; modelName: string }>(
        `/ai-agents/${selected.id}/test`,
        { message: testMessage, customerName: "Test Customer", customerPhone: "+15550100001" },
        { tenantId: currentTenantId }
      );
      setTestReply(`${result.reply}\n\nModel: ${result.modelName} | Confidence: ${Math.round(result.confidence * 100)}%`);
      setNotice("Agent test completed.");
    } catch (error) {
      setNotice(errorMessage(error, "Could not test agent."));
    }
  }

  function updateSelected(patch: Partial<AiAgent>) {
    setSelected((current) => (current ? { ...current, ...patch } : current));
  }

  function toggleTool(tool: string) {
    if (!selected) return;
    const exists = selected.toolPermissions.includes(tool);
    updateSelected({
      toolPermissions: exists
        ? selected.toolPermissions.filter((item) => item !== tool)
        : [...selected.toolPermissions, tool]
    });
  }

  function toggleDocument(documentId: string) {
    if (!selected) return;
    const exists = selected.knowledgeDocumentIds.includes(documentId);
    updateSelected({
      knowledgeDocumentIds: exists
        ? selected.knowledgeDocumentIds.filter((item) => item !== documentId)
        : [...selected.knowledgeDocumentIds, documentId]
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <Brain className="h-3.5 w-3.5" />
            AI Agent Platform
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">AI Agent Builder</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Build specialized agents for sales, support, bookings, orders, and industry workflows with tenant-scoped knowledge and tools.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void saveAgent()} disabled={!selected || saving}>
            <Save className="h-4 w-4" />
            Save agent
          </Button>
        </div>
      </div>

      {notice ? <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
          <Skeleton className="h-[720px] rounded-lg" />
          <Skeleton className="h-[720px] rounded-lg" />
          <Skeleton className="h-[720px] rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
          <aside className="space-y-4">
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Templates</h2>
              </div>
              <div className="mt-3 space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => void createFromTemplate(template)}
                    className="w-full rounded-md border bg-background p-3 text-left transition hover:border-foreground/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{template.name}</p>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Agents</h2>
              </div>
              <div className="mt-3 space-y-2">
                {agents.length ? (
                  agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(agent.id);
                        setSelected(agent);
                      }}
                      className={`w-full rounded-md border p-3 text-left transition ${
                        selected?.id === agent.id ? "border-foreground/40 bg-accent" : "bg-background hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{agent.name}</p>
                        <Badge variant={agent.status === "ACTIVE" ? "success" : "neutral"}>{agent.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{agent.description ?? "Custom AI agent"}</p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Pick a template to create your first AI agent.
                  </div>
                )}
              </div>
            </section>
          </aside>

          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border bg-card p-5 shadow-sm">
            {selected ? (
              <div className="space-y-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <Badge variant={selected.status === "ACTIVE" ? "success" : "neutral"}>{selected.status}</Badge>
                    <h2 className="mt-3 text-xl font-semibold">{selected.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Version {selected.activeVersion} agent configuration</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void createVersion()}>
                      <History className="h-4 w-4" />
                      Version
                    </Button>
                    <Button variant="outline" onClick={() => void setStatus(selected.status === "ACTIVE" ? "deactivate" : "activate")}>
                      <ToggleLeft className="h-4 w-4" />
                      {selected.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Agent name">
                    <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
                  </Field>
                  <Field label="Model">
                    <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.modelName} onChange={(event) => updateSelected({ modelName: event.target.value })} />
                  </Field>
                  <Field label="Personality">
                    <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.personality} onChange={(event) => updateSelected({ personality: event.target.value })} />
                  </Field>
                  <Field label="Tone">
                    <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.tone} onChange={(event) => updateSelected({ tone: event.target.value })} />
                  </Field>
                  <Field label="Provider">
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.provider} onChange={(event) => updateSelected({ provider: event.target.value as AiProvider })}>
                      <option value="OPENAI">OpenAI</option>
                      <option value="GEMINI">Gemini placeholder</option>
                    </select>
                  </Field>
                  <Field label="Temperature">
                    <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" max="1" step="0.1" value={selected.temperature} onChange={(event) => updateSelected({ temperature: Number(event.target.value) })} />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={selected.description ?? ""} onChange={(event) => updateSelected({ description: event.target.value })} />
                </Field>

                <Field label="System prompt">
                  <textarea className="min-h-40 w-full rounded-md border bg-background px-3 py-2 text-sm" value={selected.systemPrompt} onChange={(event) => updateSelected({ systemPrompt: event.target.value })} />
                </Field>

                <Field label="Custom prompt editor">
                  <textarea className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm" value={selected.customPrompt ?? ""} onChange={(event) => updateSelected({ customPrompt: event.target.value })} />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Languages">
                    <textarea className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm" value={listToText(selected.supportedLanguages)} onChange={(event) => updateSelected({ supportedLanguages: textToList(event.target.value) })} />
                  </Field>
                  <Field label="Allowed actions">
                    <textarea className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm" value={listToText(selected.allowedActions)} onChange={(event) => updateSelected({ allowedActions: textToList(event.target.value) })} />
                  </Field>
                </div>

                <Field label="Handover rules">
                  <textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" value={listToText(selected.handoverRules)} onChange={(event) => updateSelected({ handoverRules: textToList(event.target.value) })} />
                </Field>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Tool permissions</h3>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {toolOptions.map((tool) => (
                      <label key={tool} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                        <span>{tool}</span>
                        <input type="checkbox" checked={selected.toolPermissions.includes(tool)} onChange={() => toggleTool(tool)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Assign WhatsApp account">
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.assignedWhatsappAccount?.id ?? ""} onChange={(event) => updateSelected({ assignedWhatsappAccount: whatsAppAccounts.find((account) => account.id === event.target.value) ?? null })}>
                      <option value="">No WhatsApp account</option>
                      {whatsAppAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.displayName ?? account.displayPhoneNumber}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Assign chatbot">
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected.assignedChatbot?.id ?? ""} onChange={(event) => updateSelected({ assignedChatbot: chatbots.find((chatbot) => chatbot.id === event.target.value) ?? null })}>
                      <option value="">No chatbot flow</option>
                      {chatbots.map((chatbot) => (
                        <option key={chatbot.id} value={chatbot.id}>{chatbot.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed text-center">
                <div>
                  <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
                  <h2 className="mt-3 text-sm font-semibold">No agent selected</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose a template to start building a specialized AI agent.</p>
                </div>
              </div>
            )}
          </motion.section>

          <aside className="space-y-4">
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Test playground</h2>
              </div>
              <textarea className="mt-3 min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm" value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
              <Button className="mt-3 w-full" onClick={() => void testAgent()} disabled={!selected}>
                <Send className="h-4 w-4" />
                Test agent
              </Button>
              {testReply ? <pre className="mt-3 whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">{testReply}</pre> : null}
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Knowledge sources</h2>
              </div>
              <div className="mt-3 space-y-2">
                {documents.length && selected ? (
                  documents.map((document) => (
                    <label key={document.id} className="flex items-start justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                      <span>
                        <span className="block font-medium">{document.title}</span>
                        <span className="text-xs text-muted-foreground">{document.chunkCount} chunks</span>
                      </span>
                      <input type="checkbox" checked={selected.knowledgeDocumentIds.includes(document.id)} onChange={() => toggleDocument(document.id)} />
                    </label>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Completed knowledge documents will appear here.</div>
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Version history</h2>
              </div>
              <div className="mt-3 space-y-2">
                {selected?.versions.length ? (
                  selected.versions.map((version) => (
                    <div key={version.id} className="rounded-md border bg-background p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="font-medium">Version {version.version}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{version.changelog ?? "No changelog"} - {formatDate(version.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">No versions yet.</div>
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Play className="h-4 w-4" />
                Runtime note
              </div>
              <p className="mt-2">
                Published agents are ready to be connected to WhatsApp accounts and chatbot flows. Full routing into the live message pipeline can be expanded after approval rules are finalized.
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

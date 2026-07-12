"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Brain,
  CalendarClock,
  DollarSign,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserRound,
  X
} from "lucide-react";
import { Badge, Button, cn, Skeleton } from "@novachat/ui";
import { apiClient } from "@/lib/api-client";

type Lead = {
  id: string;
  title: string;
  status: "OPEN" | "WON" | "LOST" | "ARCHIVED";
  source: string | null;
  value: number | null;
  currency: string;
  score: number;
  expectedCloseDate: string | null;
  followUpAt: string | null;
  followUpNote: string | null;
  aiNextAction: string | null;
  customer: { id: string; name: string | null; email: string | null; phone: string };
  stage: { id: string; name: string; color: string | null; position: number };
  assignedUser: { id: string; name: string | null; email: string } | null;
  createdAt: string;
};

type StageColumn = {
  id: string;
  name: string;
  color: string | null;
  position: number;
  isDefault: boolean;
  leads: Lead[];
};

type Assignee = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

const emptyLeadForm = {
  title: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  source: "",
  value: "",
  followUpAt: "",
  expectedCloseDate: ""
};

function formatMoney(value: number | null, currency: string) {
  if (value === null) {
    return "No value";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function statusVariant(status: Lead["status"]) {
  if (status === "WON") {
    return "success";
  }

  if (status === "LOST") {
    return "warning";
  }

  return "neutral";
}

export default function LeadsPage() {
  const [columns, setColumns] = React.useState<StageColumn[]>([]);
  const [assignees, setAssignees] = React.useState<Assignee[]>([]);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(emptyLeadForm);
  const [stageName, setStageName] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);

  const loadKanban = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<StageColumn[]>("/leads/kanban");
      setColumns(result);
      setMessage(null);
    } catch {
      setMessage("API is offline. Start the backend on port 4000 and refresh leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadKanban();
    void apiClient.get<Assignee[]>("/inbox/assignees").then(setAssignees).catch(() => undefined);
  }, [loadKanban]);

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const stageId = columns[0]?.id;
      await apiClient.post("/leads", {
        title: form.title,
        stageId,
        source: form.source || undefined,
        value: form.value ? Number(form.value) : undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
        followUpAt: form.followUpAt || undefined,
        customer: {
          name: form.customerName || undefined,
          email: form.customerEmail || undefined,
          phone: form.customerPhone,
          status: "ACTIVE"
        }
      });
      setForm(emptyLeadForm);
      await loadKanban();
      setMessage("Lead created.");
    } catch {
      setMessage("Could not create lead. Customer phone and lead title are required.");
    } finally {
      setSaving(false);
    }
  }

  async function createStage() {
    if (!stageName.trim()) {
      return;
    }

    await apiClient.post("/lead-stages", {
      name: stageName.trim(),
      color: "#6366f1"
    });
    setStageName("");
    await loadKanban();
  }

  async function moveLead(leadId: string, stageId: string) {
    await apiClient.patch(`/leads/${leadId}/stage`, { stageId });
    await loadKanban();
  }

  async function updateLead(leadId: string, input: Record<string, unknown>) {
    const updated = await apiClient.patch<Lead>(`/leads/${leadId}`, input);
    setSelectedLead(updated);
    await loadKanban();
  }

  async function markOutcome(leadId: string, status: "WON" | "LOST") {
    const updated = await apiClient.patch<Lead>(`/leads/${leadId}/outcome`, { status });
    setSelectedLead(updated);
    await loadKanban();
  }

  const filteredColumns = query.trim()
    ? columns.map((column) => ({
        ...column,
        leads: column.leads.filter((lead) =>
          `${lead.title} ${lead.customer.name ?? ""} ${lead.customer.phone} ${lead.source ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
      }))
    : columns;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            CRM / Pipeline
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Leads CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track opportunities, reminders, ownership, expected close dates, and AI scoring placeholders.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadKanban()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {message ? (
        <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{message}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search leads"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <div className="flex gap-2">
              <input
                value={stageName}
                onChange={(event) => setStageName(event.target.value)}
                placeholder="New stage"
                className="h-10 rounded-md border bg-background px-3 text-sm"
              />
              <Button type="button" variant="outline" onClick={() => void createStage()}>
                Add stage
              </Button>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[620px] w-80 shrink-0 rounded-lg" />
              ))
            ) : filteredColumns.length ? (
              filteredColumns.map((column) => (
                <div
                  key={column.id}
                  className="min-h-[620px] w-80 shrink-0 rounded-lg border bg-card shadow-sm"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const leadId = event.dataTransfer.getData("text/plain");
                    if (leadId) {
                      void moveLead(leadId, column.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between border-b p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: column.color ?? "#6366f1" }}
                      />
                      <h2 className="text-sm font-semibold">{column.name}</h2>
                    </div>
                    <Badge>{column.leads.length}</Badge>
                  </div>
                  <div className="space-y-3 p-3">
                    {column.leads.length ? (
                      column.leads.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          draggable
                          onDragStart={(event: React.DragEvent<HTMLButtonElement>) =>
                            event.dataTransfer.setData("text/plain", lead.id)
                          }
                          onClick={() => setSelectedLead(lead)}
                          className="w-full rounded-lg border bg-background p-3 text-left shadow-sm transition hover:bg-accent"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{lead.title}</p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {lead.customer.name ?? lead.customer.phone}
                              </p>
                            </div>
                            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md border p-2">
                              <p className="text-muted-foreground">Value</p>
                              <p className="font-semibold">{formatMoney(lead.value, lead.currency)}</p>
                            </div>
                            <div className="rounded-md border p-2">
                              <p className="text-muted-foreground">Score</p>
                              <p className="font-semibold">{lead.score}/100</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Follow up {formatDate(lead.followUpAt)}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Drop leads here
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                No pipeline stages yet. Add a stage to start.
              </div>
            )}
          </div>
        </section>

        <aside>
          <form onSubmit={(event) => void createLead(event)} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Create lead</h2>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Lead title"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                required
              />
              <input
                value={form.customerName}
                onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                placeholder="Customer name"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
              <input
                value={form.customerPhone}
                onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))}
                placeholder="Customer phone"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                required
              />
              <input
                value={form.customerEmail}
                onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))}
                placeholder="Customer email"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.value}
                  onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                  placeholder="Value"
                  type="number"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
                <input
                  value={form.source}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                  placeholder="Source"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
              </div>
              <label className="block text-xs text-muted-foreground">
                Expected close
                <input
                  value={form.expectedCloseDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, expectedCloseDate: event.target.value }))
                  }
                  type="date"
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Follow-up reminder
                <input
                  value={form.followUpAt}
                  onChange={(event) => setForm((current) => ({ ...current, followUpAt: event.target.value }))}
                  type="datetime-local"
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                />
              </label>
              <Button type="submit" disabled={saving || !columns.length} className="w-full">
                Save lead
              </Button>
            </div>
          </form>

          <div className="mt-4 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">AI foundation</h2>
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>AI lead scoring placeholder stores score metadata on each lead.</p>
              <p>AI follow-up suggestion placeholder stores the next recommended action.</p>
            </div>
          </div>
        </aside>
      </div>

      {selectedLead ? (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{selectedLead.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedLead.customer.name ?? selectedLead.customer.phone} / {selectedLead.stage.name}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedLead(null)} aria-label="Close lead">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <Metric icon={DollarSign} label="Value" value={formatMoney(selectedLead.value, selectedLead.currency)} />
            <Metric icon={Target} label="Score" value={`${selectedLead.score}/100`} />
            <Metric icon={CalendarClock} label="Close" value={formatDate(selectedLead.expectedCloseDate)} />
          </div>

          <section className="mt-5 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Assignment</h3>
            <select
              value={selectedLead.assignedUser?.id ?? ""}
              onChange={(event) =>
                void updateLead(selectedLead.id, { assignedUserId: event.target.value || null })
              }
              className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Unassigned</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name ?? assignee.email} ({assignee.role})
                </option>
              ))}
            </select>
          </section>

          <section className="mt-5 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Follow-up reminder</h3>
            <input
              type="datetime-local"
              className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm"
              onChange={(event) => void updateLead(selectedLead.id, { followUpAt: event.target.value })}
            />
            <textarea
              defaultValue={selectedLead.followUpNote ?? ""}
              placeholder="Follow-up note"
              className="mt-3 min-h-20 w-full resize-none rounded-md border bg-background p-3 text-sm"
              onBlur={(event) => void updateLead(selectedLead.id, { followUpNote: event.target.value })}
            />
          </section>

          <section className="mt-5 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">AI scoring foundation</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {selectedLead.aiNextAction ??
                "AI follow-up suggestions will appear after the AI automation phase."}
            </p>
          </section>

          <section className="mt-5 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Customer</h3>
            </div>
            <p className="mt-3 text-sm font-medium">
              {selectedLead.customer.name ?? "Unnamed customer"}
            </p>
            <p className="text-sm text-muted-foreground">{selectedLead.customer.phone}</p>
            {selectedLead.customer.email ? (
              <p className="text-sm text-muted-foreground">{selectedLead.customer.email}</p>
            ) : null}
          </section>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => void markOutcome(selectedLead.id, "LOST")}>
              Mark lost
            </Button>
            <Button type="button" onClick={() => void markOutcome(selectedLead.id, "WON")}>
              Mark won
            </Button>
          </div>
        </motion.aside>
      ) : null}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-3")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

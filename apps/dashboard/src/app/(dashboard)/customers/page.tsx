"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileUp,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Tag,
  UserRound,
  X
} from "lucide-react";
import { Badge, Button, cn, Skeleton } from "@novachat/ui";
import { API_URL, apiClient } from "@/lib/api-client";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string;
  status: "ACTIVE" | "BLOCKED" | "ARCHIVED";
  tags: Array<{ id: string; name: string; color: string | null }>;
  counts: {
    conversations: number;
    leads: number;
    notes: number;
    orders: number;
    appointments: number;
  };
  createdAt: string;
  updatedAt: string;
};

type CustomerProfile = {
  customer: Customer;
  timeline: Array<{
    id: string;
    direction: string;
    senderType: string;
    text: string | null;
    status: string;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    author: { id: string; name: string | null; email: string } | null;
    createdAt: string;
  }>;
  conversations: Array<{
    id: string;
    status: string;
    subject: string | null;
    lastMessageAt: string | null;
  }>;
  leads: Array<{
    id: string;
    title: string;
    status: string;
    value: number | null;
    currency: string;
    stage: { name: string };
  }>;
};

type PaginatedResult<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const emptyCustomer = {
  name: "",
  email: "",
  phone: ""
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusVariant(status: Customer["status"]) {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "BLOCKED") {
    return "warning";
  }

  return "neutral";
}

export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<CustomerProfile | null>(null);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("ACTIVE");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(emptyCustomer);
  const [note, setNote] = React.useState("");
  const [tagName, setTagName] = React.useState("");
  const [csv, setCsv] = React.useState("name,email,phone,company\n");
  const [message, setMessage] = React.useState<string | null>(null);

  const loadCustomers = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: "1",
      pageSize: "50",
      sortBy: "createdAt",
      sortDirection: "desc"
    });

    if (query.trim()) {
      params.set("search", query.trim());
    }

    if (status !== "ALL") {
      params.set("status", status);
    }

    try {
      const result = await apiClient.get<PaginatedResult<Customer>>(`/customers?${params.toString()}`);
      setCustomers(result.items);
      setMessage(null);
    } catch {
      setMessage("API is offline. Start the backend on port 4000 and refresh customers.");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  const loadProfile = React.useCallback(async (customerId: string) => {
    try {
      const result = await apiClient.get<CustomerProfile>(`/customers/${customerId}`);
      setProfile(result);
      setSelectedId(customerId);
    } catch {
      setMessage("Could not load the customer profile.");
    }
  }, []);

  React.useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await apiClient.post<Customer>("/customers", {
        ...form,
        status: "ACTIVE"
      });
      setForm(emptyCustomer);
      await loadCustomers();
      setMessage("Customer saved.");
    } catch {
      setMessage("Could not save customer. Check the phone number and API status.");
    } finally {
      setSaving(false);
    }
  }

  async function importCustomers() {
    setSaving(true);

    try {
      const result = await apiClient.post<{ imported: number; skipped: number }>("/customers/import", {
        csv,
        updateExisting: true
      });
      await loadCustomers();
      setMessage(`Imported ${result.imported} customers. Skipped ${result.skipped}.`);
    } catch {
      setMessage("CSV import failed. Confirm your headers are name,email,phone,company.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!profile || !note.trim()) {
      return;
    }

    await apiClient.post(`/customers/${profile.customer.id}/notes`, { body: note.trim() });
    setNote("");
    await loadProfile(profile.customer.id);
  }

  async function addTag() {
    if (!profile || !tagName.trim()) {
      return;
    }

    await apiClient.post(`/customers/${profile.customer.id}/tags`, { name: tagName.trim() });
    setTagName("");
    await loadProfile(profile.customer.id);
    await loadCustomers();
  }

  async function archiveCustomer(customerId: string) {
    await apiClient.delete(`/customers/${customerId}`);
    if (selectedId === customerId) {
      setSelectedId(null);
      setProfile(null);
    }
    await loadCustomers();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            CRM / Customers
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage customer records, tags, notes, timelines, conversations, and leads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadCustomers()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={() => window.open(`${API_URL}/customers/export`)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{message}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email, or phone"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              aria-label="Filter customer status"
            >
              <option value="ACTIVE">Active</option>
              <option value="BLOCKED">Blocked</option>
              <option value="ARCHIVED">Archived</option>
              <option value="ALL">All</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tags</th>
                  <th className="px-4 py-3 font-medium">Activity</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-b">
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-12 rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : customers.length ? (
                  customers.map((customer) => (
                    <tr key={customer.id} className="border-b transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void loadProfile(customer.id)}
                          className="text-left"
                        >
                          <span className="block font-medium">{customer.name ?? "Unnamed customer"}</span>
                          <span className="block text-xs text-muted-foreground">
                            {customer.phone} {customer.email ? `/ ${customer.email}` : ""}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(customer.status)}>{customer.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-52 flex-wrap gap-1">
                          {customer.tags.length ? (
                            customer.tags.map((tag) => (
                              <span key={tag.id} className="rounded-full border px-2 py-0.5 text-xs">
                                {tag.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No tags</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {customer.counts.conversations} chats / {customer.counts.leads} leads /{" "}
                        {customer.counts.notes} notes
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(customer.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void archiveCustomer(customer.id)}
                        >
                          Archive
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No customers yet. Create one or import a CSV to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <form onSubmit={(event) => void createCustomer(event)} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Create customer</h2>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Name"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Email"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Phone"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                required
              />
              <Button type="submit" disabled={saving} className="w-full">
                Save customer
              </Button>
            </div>
          </form>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">CSV import</h2>
            </div>
            <textarea
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              className="mt-4 min-h-32 w-full resize-none rounded-md border bg-background p-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => void importCustomers()}>
              Import contacts
            </Button>
          </div>
        </aside>
      </div>

      {profile ? (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l bg-background p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{profile.customer.name ?? "Customer profile"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.customer.phone} {profile.customer.email ? `/ ${profile.customer.email}` : ""}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setProfile(null)} aria-label="Close profile">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <MiniMetric label="Chats" value={profile.customer.counts.conversations} />
            <MiniMetric label="Leads" value={profile.customer.counts.leads} />
            <MiniMetric label="Notes" value={profile.customer.counts.notes} />
          </div>

          <section className="mt-5 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tags</h3>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.customer.tags.map((tag) => (
                <span key={tag.id} className="rounded-full border px-2.5 py-1 text-xs">
                  {tag.name}
                </span>
              ))}
              {!profile.customer.tags.length ? (
                <span className="text-xs text-muted-foreground">No tags yet</span>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                placeholder="New tag"
                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
              />
              <Button type="button" variant="outline" onClick={() => void addTag()}>
                Add
              </Button>
            </div>
          </section>

          <section className="mt-5 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Notes</h3>
            <div className="mt-3 flex gap-2">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Write a customer note"
                className="min-h-20 flex-1 resize-none rounded-md border bg-background p-3 text-sm"
              />
              <Button type="button" onClick={() => void addNote()}>
                Add
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {profile.notes.map((item) => (
                <div key={item.id} className="rounded-md border bg-card p-3 text-sm">
                  <p>{item.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.author?.name ?? item.author?.email ?? "Team"} / {formatDate(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Timeline</h3>
            <div className="mt-4 space-y-3">
              {profile.timeline.length ? (
                profile.timeline.map((event) => (
                  <div key={event.id} className="flex gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p>{event.text ?? "Message event"}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.direction} / {formatDate(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No timeline activity yet.</p>
              )}
            </div>
          </section>
        </motion.aside>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn("rounded-lg border bg-card p-3")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

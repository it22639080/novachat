"use client";

import * as React from "react";
import { Check, Search, ShieldAlert, X } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@novachat/ui";
import { apiClient } from "@/lib/api-client";
import { displayValue, findCollection, queryString, type JsonRecord } from "./admin-helpers";

type AdminCollectionPageProps = {
  title: string;
  description: string;
  endpoint: string;
  collectionKeys: string[];
  searchable?: boolean;
  statusFilter?: boolean;
  actions?: "approvals" | "payments" | "users" | "plans";
};

const defaultColumns = ["name", "email", "status", "planName", "billingStatus", "createdAt"];

function columnsFor(rows: JsonRecord[]) {
  const keys = new Set<string>();
  for (const row of rows.slice(0, 10)) {
    for (const key of Object.keys(row)) {
      if (!["metadata", "featuresJson", "rawOnboardingMetadata", "setupErrors"].includes(key)) {
        keys.add(key);
      }
    }
  }

  const preferred = defaultColumns.filter((key) => keys.has(key));
  const remaining = Array.from(keys).filter((key) => !preferred.includes(key)).slice(0, 5);
  return [...preferred, ...remaining].slice(0, 7);
}

function rowId(row: JsonRecord) {
  const id = row.id ?? row.tenantId ?? row.userId;
  return typeof id === "string" ? id : null;
}

export function AdminCollectionPage({
  title,
  description,
  endpoint,
  collectionKeys,
  searchable = true,
  statusFilter = true,
  actions
}: AdminCollectionPageProps) {
  const [rows, setRows] = React.useState<JsonRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [workingId, setWorkingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const collectionKeySignature = collectionKeys.join("|");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiClient.get<unknown>(
        `${endpoint}${queryString({ search: searchable ? search : undefined, status: statusFilter ? status : undefined })}`
      );
      setRows(findCollection(payload, collectionKeySignature.split("|")));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [collectionKeySignature, endpoint, search, searchable, status, statusFilter, title]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function runAction(path: string, body?: unknown, method: "post" | "patch" = "post", success = "Action completed") {
    setWorkingId(path);
    setError(null);
    setMessage(null);
    try {
      if (method === "patch") {
        await apiClient.patch(path, body);
      } else {
        await apiClient.post(path, body);
      }
      setMessage(success);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setWorkingId(null);
    }
  }

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await runAction(
      "/admin/plans",
      {
        code: String(formData.get("code")),
        name: String(formData.get("name")),
        description: String(formData.get("description") ?? ""),
        monthlyPrice: String(formData.get("monthlyPrice") ?? "0"),
        yearlyPrice: String(formData.get("yearlyPrice") ?? "0"),
        currency: String(formData.get("currency") ?? "USD"),
        aiReplyLimit: Number(formData.get("aiReplyLimit") ?? 0),
        aiInputTokenLimit: Number(formData.get("aiInputTokenLimit") ?? 0),
        aiOutputTokenLimit: Number(formData.get("aiOutputTokenLimit") ?? 0),
        whatsappMessageLimit: Number(formData.get("whatsappMessageLimit") ?? 0),
        agentLimit: Number(formData.get("agentLimit") ?? 1),
        whatsappAccountLimit: Number(formData.get("whatsappAccountLimit") ?? 1),
        knowledgeBaseStorageLimitBytes: Number(formData.get("knowledgeBaseStorageLimitBytes") ?? 0),
        featuresJson: {}
      },
      "post",
      "Plan created"
    );
    event.currentTarget.reset();
  }

  const columns = columnsFor(rows);

  return (
    <div className="space-y-5">
      <div>
        <Badge variant="neutral">Admin</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>Real platform data with tenant-safe admin actions.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {searchable ? (
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search"
                    className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-64"
                  />
                </label>
              ) : null}
              {statusFilter ? (
                <input
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  placeholder="Status filter"
                  className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              ) : null}
              <Button type="button" variant="outline" onClick={() => void load()}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div> : null}
          {message ? <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{message}</div> : null}

          {actions === "plans" ? (
            <form className="mb-5 grid gap-3 rounded-lg border p-4 lg:grid-cols-4" onSubmit={createPlan}>
              <input name="code" required placeholder="code" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="name" required placeholder="Plan name" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="monthlyPrice" placeholder="Monthly price" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="yearlyPrice" placeholder="Yearly price" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="currency" placeholder="Currency" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="aiReplyLimit" type="number" placeholder="AI replies" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="whatsappMessageLimit" type="number" placeholder="WhatsApp messages" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="agentLimit" type="number" placeholder="Agents" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="aiInputTokenLimit" type="number" placeholder="Input tokens" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="aiOutputTokenLimit" type="number" placeholder="Output tokens" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="whatsappAccountLimit" type="number" placeholder="WhatsApp accounts" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="knowledgeBaseStorageLimitBytes" type="number" placeholder="Storage bytes" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <textarea name="description" placeholder="Description" className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm lg:col-span-3" />
              <Button disabled={Boolean(workingId)}>Create plan</Button>
            </form>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
              No records found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-3 font-medium">
                        {column}
                      </th>
                    ))}
                    {actions ? <th className="px-4 py-3 font-medium">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const id = rowId(row);
                    const tenantId = typeof row.tenantId === "string" ? row.tenantId : id;
                    const disabled = !id || Boolean(workingId);
                    return (
                      <tr key={id ?? index} className="border-b last:border-b-0">
                        {columns.map((column) => (
                          <td key={column} className="max-w-72 truncate px-4 py-3">
                            {displayValue(row[column])}
                          </td>
                        ))}
                        {actions ? (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {actions === "approvals" ? (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() =>
                                      id &&
                                      void runAction(
                                        `/admin/tenants/${id}/status`,
                                        { status: "APPROVED" },
                                        "patch",
                                        "Account approved"
                                      )
                                    }
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() =>
                                      id &&
                                      void runAction(
                                        `/admin/tenants/${id}/status`,
                                        { status: "REJECTED", reason: "Rejected by admin review" },
                                        "patch",
                                        "Account rejected"
                                      )
                                    }
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() =>
                                      id &&
                                      void runAction(
                                        `/admin/tenants/${id}/status`,
                                        { status: "SUSPENDED", reason: "Suspended by platform admin" },
                                        "patch",
                                        "Account suspended"
                                      )
                                    }
                                  >
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    Suspend
                                  </Button>
                                </>
                              ) : null}
                              {actions === "users" ? (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() => id && void runAction(`/admin/users/${id}/approve`, undefined, "post", "Account approved")}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() =>
                                      id &&
                                      void runAction(
                                        `/admin/users/${id}/reject`,
                                        { reason: "Rejected by admin review" },
                                        "post",
                                        "Account rejected"
                                      )
                                    }
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() =>
                                      id &&
                                      void runAction(
                                        `/admin/users/${id}/suspend`,
                                        { reason: "Suspended by platform admin" },
                                        "post",
                                        "Account suspended"
                                      )
                                    }
                                  >
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    Suspend
                                  </Button>
                                </>
                              ) : null}
                              {actions === "payments" ? (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() => id && void runAction(`/admin/payments/${id}/approve`, undefined, "post", "Payment approved")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() =>
                                      id &&
                                      void runAction(
                                        `/admin/payments/${id}/reject`,
                                        { notes: "Receipt rejected by admin review" },
                                        "post",
                                        "Payment rejected"
                                      )
                                    }
                                  >
                                    Reject
                                  </Button>
                                </>
                              ) : null}
                              {actions === "plans" && id ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={Boolean(workingId)}
                                  onClick={() =>
                                    void runAction(
                                      `/admin/plans/${id}`,
                                      { isActive: row.isActive === false },
                                      "patch",
                                      "Plan status updated"
                                    )
                                  }
                                >
                                  {row.isActive === false ? "Activate" : "Deactivate"}
                                </Button>
                              ) : null}
                              {actions === "users" && tenantId ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={Boolean(workingId)}
                                  onClick={() =>
                                    void runAction(
                                      `/admin/tenants/${tenantId}/status`,
                                      { status: "APPROVED" },
                                      "patch",
                                      "Tenant reactivated"
                                    )
                                  }
                                >
                                  Reactivate
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@novachat/ui";
import { apiClient } from "@/lib/api-client";
import { displayValue, getArray, getRecord, type JsonRecord } from "./admin-helpers";

type AdminDetailPageProps = {
  title: string;
  description: string;
  endpoint: string;
};

function DetailGrid({ title, record }: { title: string; record: JsonRecord }) {
  const entries = Object.entries(record).filter(([, value]) => !Array.isArray(value) && typeof value !== "object");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Tenant-safe platform record.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.length ? (
          entries.map(([key, value]) => (
            <div key={key} className="rounded-lg border p-3">
              <p className="text-xs uppercase text-muted-foreground">{key}</p>
              <p className="mt-1 break-words text-sm font-medium">{displayValue(value)}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No scalar fields available.</p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailTable({ title, rows }: { title: string; rows: JsonRecord[] }) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 7);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length.toLocaleString()} records</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.id ?? index)} className="border-b last:border-b-0">
                    {columns.map((column) => (
                      <td key={column} className="max-w-72 truncate px-4 py-3">
                        {displayValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No records yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminDetailPage({ title, description, endpoint }: AdminDetailPageProps) {
  const [payload, setPayload] = React.useState<JsonRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setPayload(getRecord(await apiClient.get<unknown>(endpoint)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admin detail");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const root = payload ?? {};
  const objectSections = Object.entries(root).filter(([, value]) => value && typeof value === "object" && !Array.isArray(value));
  const arraySections = Object.entries(root).filter(([, value]) => Array.isArray(value));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="neutral">Admin</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div> : null}

      <DetailGrid title="Overview" record={root} />
      {objectSections.map(([key, value]) => (
        <DetailGrid key={key} title={key} record={getRecord(value)} />
      ))}
      {arraySections.map(([key, value]) => (
        <DetailTable key={key} title={key} rows={getArray(value)} />
      ))}
    </div>
  );
}

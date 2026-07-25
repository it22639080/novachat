"use client";

import * as React from "react";
import { Activity, CreditCard, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@novachat/ui";
import { apiClient } from "@/lib/api-client";
import { displayValue, getRecord } from "./admin-helpers";

type DashboardData = {
  totals?: Record<string, unknown>;
  recent?: Record<string, unknown>;
};

const metricIcons = [UsersRound, ShieldCheck, CreditCard, MessageCircle, Activity];

function metricLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}

export function AdminDashboard() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await apiClient.get<DashboardData>("/admin/dashboard");
        if (!cancelled) {
          setData(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load admin dashboard");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = getRecord(data?.totals);

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="neutral">Platform overview</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Super Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review approvals, billing, subscriptions, WhatsApp health, and tenant usage from one place.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(totals).map(([key, value], index) => {
            const Icon = metricIcons[index % metricIcons.length] ?? Activity;
            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{metricLabel(key)}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{displayValue(value)}</p>
                </CardContent>
              </Card>
            );
          })}
          {Object.keys(totals).length === 0 ? (
            <Card className="sm:col-span-2 xl:col-span-4">
              <CardHeader>
                <CardTitle>No platform metrics yet</CardTitle>
                <CardDescription>Metrics appear after tenants, usage, invoices, and WhatsApp sessions exist.</CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

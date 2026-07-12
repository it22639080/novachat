"use client";

import { Building2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";

export default function SelectTenantPage() {
  const { tenants, switchTenant, logout } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select workspace</CardTitle>
        <CardDescription>Choose the tenant context for this session.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tenants.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            No active tenant memberships are available for this account.
          </div>
        ) : (
          tenants.map((tenant) => (
            <button
              key={tenant.id}
              className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent"
              onClick={() => switchTenant(tenant.id)}
              type="button"
            >
              <span className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="block text-sm font-medium">{tenant.name}</span>
                  <span className="block text-xs text-muted-foreground">{tenant.role}</span>
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{tenant.plan ?? "free"}</span>
            </button>
          ))
        )}
        <Button className="w-full" variant="outline" onClick={logout}>
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}

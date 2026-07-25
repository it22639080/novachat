"use client";

import * as React from "react";
import { CheckCircle2, Clock3, LogOut, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";

function statusCopy(status: string | undefined) {
  switch (status) {
    case "PENDING_EMAIL_VERIFICATION":
      return {
        icon: Clock3,
        title: "Email verification required",
        body: "Please verify your email address before NovaChat can send this workspace to admin approval.",
        badge: "Verify email"
      };
    case "PENDING_ADMIN_APPROVAL":
      return {
        icon: Clock3,
        title: "Waiting for admin approval",
        body: "Your workspace is verified and queued for platform admin review. You will be notified when it is approved.",
        badge: "Pending"
      };
    case "REJECTED":
      return {
        icon: ShieldAlert,
        title: "Account rejected",
        body: "This workspace was rejected by the platform admin. Contact support if you think this is a mistake.",
        badge: "Rejected"
      };
    case "SUSPENDED":
      return {
        icon: ShieldAlert,
        title: "Account suspended",
        body: "This workspace is suspended. Protected dashboard features are paused until an admin reactivates it.",
        badge: "Suspended"
      };
    case "EXPIRED":
      return {
        icon: ShieldAlert,
        title: "Subscription expired",
        body: "This workspace has expired. Renew or contact the platform admin to restore access.",
        badge: "Expired"
      };
    default:
      return {
        icon: CheckCircle2,
        title: "Account approved",
        body: "This workspace can access NovaChat.",
        badge: "Approved"
      };
  }
}

export default function AccountStatusPage() {
  const { tenants, activeTenant, refreshSession, logout } = useAuth();
  const tenant = activeTenant ?? tenants[0] ?? null;
  const copy = statusCopy(tenant?.status);
  const Icon = copy.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace status</CardTitle>
        <CardDescription>NovaChat protects tenant data until approval and subscription checks pass.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{copy.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
              </div>
            </div>
            <Badge variant={tenant?.status === "APPROVED" || tenant?.status === "ACTIVE" ? "success" : "warning"}>
              {copy.badge}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">{tenant?.name ?? "No workspace selected"}</p>
          <p className="mt-1 text-muted-foreground">{tenant?.role ?? "No role"} / {tenant?.plan ?? "free"}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={() => void refreshSession()}>
            Refresh status
          </Button>
          <Button type="button" variant="outline" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

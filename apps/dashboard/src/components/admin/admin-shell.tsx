"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Button, cn, Skeleton } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";

const adminNavigation = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Users", href: "/admin/users", icon: UsersRound },
  { title: "Approvals", href: "/admin/approvals", icon: ShieldCheck },
  { title: "Plans", href: "/admin/plans", icon: CreditCard },
  { title: "Subscriptions", href: "/admin/subscriptions", icon: Receipt },
  { title: "Payments", href: "/admin/payments", icon: CreditCard },
  { title: "Invoices", href: "/admin/invoices", icon: FileText },
  { title: "Usage", href: "/admin/usage", icon: Gauge },
  { title: "Notifications", href: "/admin/notifications", icon: Bell },
  { title: "Audit logs", href: "/admin/audit-logs", icon: Activity },
  { title: "System health", href: "/admin/system-health", icon: Activity }
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user, logout } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (!user?.isSuperAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-panel">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Super admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is only available to NovaChat platform administrators.
          </p>
          <Button asChild className="mt-5">
            <Link href="/dashboard">Back to workspace</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r bg-card/90 backdrop-blur-xl lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">NovaChat Admin</p>
            <p className="text-xs text-muted-foreground">Platform control center</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {adminNavigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-accent text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-sm font-semibold">Super Admin</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard">Workspace</Link>
              </Button>
              <Button variant="ghost" type="button" onClick={() => void logout()}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t px-4 py-2 lg:hidden">
            {adminNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground",
                  pathname === item.href && "bg-accent text-foreground"
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

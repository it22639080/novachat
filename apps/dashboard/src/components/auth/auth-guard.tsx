"use client";

import { Skeleton } from "@novachat/ui";
import { useAuth } from "./auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, user, activeTenant } = useAuth();

  if (loading || !user || !activeTenant) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return children;
}

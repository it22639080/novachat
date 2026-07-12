"use client";

import { useAuth } from "./auth-provider";

export function RoleGuard({
  roles,
  permission,
  children,
  fallback = null
}: {
  roles?: string[];
  permission?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasRole, hasPermission } = useAuth();

  if (roles && !hasRole(roles)) {
    return fallback;
  }

  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  return children;
}

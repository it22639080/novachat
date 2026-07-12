"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import type { AuthState, TenantAccess } from "@/lib/auth-types";

type AuthContextValue = AuthState & {
  loading: boolean;
  refreshSession: () => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    tenantName: string;
    tenantSlug?: string;
  }) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: string[]) => boolean;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = React.useState<AuthState>({
    user: null,
    tenants: [],
    activeTenant: null
  });
  const [loading, setLoading] = React.useState(true);

  const refreshSession = React.useCallback(async () => {
    try {
      const data = await apiClient.get<AuthState>("/auth/me");
      setState({
        user: data.user,
        tenants: data.tenants ?? [],
        activeTenant: data.activeTenant ?? null
      });
    } catch {
      setState({ user: null, tenants: [], activeTenant: null });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  React.useEffect(() => {
    if (loading) {
      return;
    }

    const publicPath = publicPaths.some((path) => pathname.startsWith(path));

    if (!state.user && !publicPath) {
      router.replace("/login");
      return;
    }

    if (state.user && !state.activeTenant && !publicPath && pathname !== "/select-tenant") {
      router.replace("/select-tenant" as never);
    }
  }, [loading, pathname, router, state.activeTenant, state.user]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      loading,
      refreshSession,
      async login(input) {
        const data = await apiClient.post<Pick<AuthState, "user" | "tenants">>("/auth/login", input);
        setState({ user: data.user, tenants: data.tenants ?? [], activeTenant: null });
        router.replace("/select-tenant" as never);
      },
      async register(input) {
        const data = await apiClient.post<Pick<AuthState, "user" | "activeTenant">>(
          "/auth/register",
          input
        );
        setState({
          user: data.user,
          tenants: data.activeTenant ? [data.activeTenant] : [],
          activeTenant: data.activeTenant
        });
        router.replace("/dashboard");
      },
      async switchTenant(tenantId: string) {
        const data = await apiClient.post<{ user: AuthState["user"]; activeTenant: TenantAccess }>(
          "/tenants/switch",
          { tenantId }
        );
        setState((current) => ({
          ...current,
          user: data.user,
          activeTenant: data.activeTenant
        }));
        router.replace("/dashboard");
      },
      async logout() {
        await apiClient.post("/auth/logout");
        setState({ user: null, tenants: [], activeTenant: null });
        router.replace("/login");
      },
      hasPermission(permission: string) {
        const permissions = state.activeTenant?.permissions ?? [];
        return permissions.includes("*") || permissions.includes(permission);
      },
      hasRole(roles: string[]) {
        return Boolean(state.activeTenant && roles.includes(state.activeTenant.role));
      }
    }),
    [loading, refreshSession, router, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

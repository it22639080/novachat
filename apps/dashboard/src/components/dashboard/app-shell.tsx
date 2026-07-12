"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Command,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  X
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge, Button, cn } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { SearchInput } from "./search-input";
import { navigationItems } from "./navigation";

const visibleNavigationItems = navigationItems.filter((item) => !("hidden" in item && item.hidden));

function getBreadcrumbs(pathname: string) {
  const item = navigationItems.find((navItem) => navItem.href === pathname);

  return ["Workspace", item?.title ?? "Overview"];
}

function SidebarContent({
  collapsed,
  onNavigate
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { activeTenant } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <Command className="h-4 w-4" aria-hidden="true" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">NovaChat AI</p>
            <p className="truncate text-xs text-muted-foreground">Business console</p>
          </div>
        ) : null}
      </div>

      <div className="px-3 py-4">
        <Link
          href="/select-tenant"
          {...(onNavigate ? { onClick: onNavigate } : {})}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
            collapsed && "justify-center px-2"
          )}
        >
          <span className={cn("min-w-0", collapsed && "sr-only")}>
            <span className="block truncate font-medium">{activeTenant?.name ?? "Select tenant"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {activeTenant ? `${activeTenant.role} / ${activeTenant.plan ?? "free"}` : "No workspace active"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Primary">
        {visibleNavigationItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              title={collapsed ? item.title : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-accent text-foreground shadow-sm",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed ? <span className="truncate">{item.title}</span> : null}
            </Link>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="border-t p-3">
          <div className="rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              <p className="text-xs font-medium">Setup progress</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-2 w-2/3 rounded-full bg-emerald-500" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">WhatsApp channel pending</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const isDark = theme === "dark";
  const breadcrumbs = getBreadcrumbs(pathname);
  const userInitial = user?.name?.slice(0, 1) ?? user?.email?.slice(0, 1) ?? "U";

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r bg-card/90 backdrop-blur-xl transition-[width] duration-300 lg:block",
          collapsed ? "w-20" : "w-72"
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 left-0 z-50 w-80 border-r bg-card shadow-panel lg:hidden"
            >
              <button
                type="button"
                className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className={cn("transition-[padding] duration-300 lg:pl-72", collapsed && "lg:pl-20")}>
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open navigation"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden lg:inline-flex"
                onClick={() => setCollapsed((value) => !value)}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
              <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground md:flex">
                {breadcrumbs.map((breadcrumb, index) => (
                  <React.Fragment key={breadcrumb}>
                    {index > 0 ? <span>/</span> : null}
                    <span className={cn(index === breadcrumbs.length - 1 && "font-medium text-foreground")}>
                      {breadcrumb}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <SearchInput
              className="hidden w-full max-w-md md:block"
              placeholder="Search conversations, customers, orders"
            />

            <div className="flex items-center gap-2">
              <Badge variant="warning" className="hidden sm:inline-flex">
                Setup
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Search"
                className="md:hidden"
                type="button"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Toggle color theme"
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Notifications"
                  type="button"
                  onClick={() => setNotificationsOpen((value) => !value)}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                {notificationsOpen ? (
                  <div className="absolute right-0 top-11 z-30 w-80 rounded-lg border bg-card p-3 shadow-panel">
                    <p className="text-sm font-semibold">Notifications</p>
                    <div className="mt-3 space-y-2">
                      {["Campaign audience synced", "AI confidence dipped on bulk quotes", "Invoice draft ready"].map(
                        (item) => (
                          <div key={item} className="rounded-lg border bg-background p-3 text-sm">
                            {item}
                            <p className="mt-1 text-xs text-muted-foreground">Just now</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-left transition-colors hover:bg-accent"
                  onClick={() => setProfileOpen((value) => !value)}
                  aria-haspopup="menu"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
                    {userInitial}
                  </span>
                  <span className="hidden max-w-36 truncate text-xs sm:block">
                    <span className="block truncate font-medium">{user?.name ?? "User"}</span>
                    <span className="block truncate text-muted-foreground">{user?.email}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </button>
                {profileOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-30 w-56 rounded-lg border bg-card p-1 shadow-panel"
                  >
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={logout}
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

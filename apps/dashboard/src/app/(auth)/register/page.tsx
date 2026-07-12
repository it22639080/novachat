"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiClientError } from "@/lib/api-client";

function registerErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.details && typeof error.details === "object") {
    const fieldErrors = (error.details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const messages = fieldErrors
      ? Object.values(fieldErrors)
          .flat()
          .filter(Boolean)
      : [];

    if (messages.length) {
      return messages.join(" ");
    }
  }

  return error instanceof Error ? error.message : "Unable to create workspace";
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      await register({
        name: String(formData.get("name")),
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        tenantName: String(formData.get("tenantName"))
      });
    } catch (err) {
      setError(registerErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your workspace</CardTitle>
        <CardDescription>Register the business owner and create the first tenant workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">
              Owner name
            </label>
            <input
              id="name"
              name="name"
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Owner email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Use at least 10 characters with uppercase, lowercase, number, and symbol. Example:
              NovaChat@2026
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="tenantName">
              Workspace name
            </label>
            <input
              id="tenantName"
              name="tenantName"
              required
              placeholder="ABC Fashion"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create workspace"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      await login({
        email: String(formData.get("email")),
        password: String(formData.get("password"))
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to NovaChat AI</CardTitle>
        <CardDescription>Access your tenant workspaces and continue conversations securely.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
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
              autoComplete="current-password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <Link href={"/forgot-password" as never} className="hover:text-foreground">
            Forgot password?
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Create workspace
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

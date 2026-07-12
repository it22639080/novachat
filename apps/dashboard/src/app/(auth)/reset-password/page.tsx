"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { apiClient } from "@/lib/api-client";

export default function ResetPasswordPage() {
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      await apiClient.post("/auth/reset-password", {
        token: String(formData.get("token")),
        password: String(formData.get("password"))
      });
      setMessage("Password reset successfully. You can sign in now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Use the reset token from your email or development response.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            name="token"
            required
            placeholder="Reset token"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="New password"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Reset password"}
          </Button>
        </form>
        <Link href="/login" className="mt-4 block text-sm text-muted-foreground hover:text-foreground">
          Back to login
        </Link>
      </CardContent>
    </Card>
  );
}

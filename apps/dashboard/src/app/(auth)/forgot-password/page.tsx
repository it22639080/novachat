"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { apiClient } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const data = await apiClient.post<{ message: string; resetToken: string | null }>(
      "/auth/forgot-password",
      { email: String(formData.get("email")) }
    );
    setMessage(data.resetToken ? `${data.message} Dev token: ${data.resetToken}` : data.message);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Email delivery is a placeholder; development tokens are returned safely for now.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
          />
          <Button className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset instructions"}
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
        <Link href="/login" className="mt-4 block text-sm text-muted-foreground hover:text-foreground">
          Back to login
        </Link>
      </CardContent>
    </Card>
  );
}

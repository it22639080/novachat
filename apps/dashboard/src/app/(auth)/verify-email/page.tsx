"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { apiClient } from "@/lib/api-client";

type VerifyResponse = {
  emailVerified: boolean;
};

export default function VerifyEmailPage() {
  return (
    <React.Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle>Verify email</CardTitle>
            <CardDescription>Preparing email verification...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
              <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading verification link...</p>
            </div>
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailContent />
    </React.Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { refreshSession } = useAuth();
  const [status, setStatus] = React.useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = React.useState("Verifying your email address...");

  React.useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Please use the link from your email.");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        await apiClient.post<VerifyResponse>("/auth/verify-email", { token });
        await refreshSession();
        if (!cancelled) {
          setStatus("success");
          setMessage("Email verified. Your workspace is now waiting for admin approval.");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Email verification failed.");
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [refreshSession, searchParams]);

  const Icon = status === "success" ? CheckCircle2 : status === "error" ? XCircle : Loader2;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify email</CardTitle>
        <CardDescription>NovaChat checks ownership before sending the account to admin review.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <Icon
            className={status === "loading" ? "mt-0.5 h-5 w-5 animate-spin text-muted-foreground" : "mt-0.5 h-5 w-5"}
          />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/account-status">View account status</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

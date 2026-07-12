"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Card, CardContent } from "@novachat/ui";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

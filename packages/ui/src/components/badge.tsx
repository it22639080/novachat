import * as React from "react";
import { cn } from "../lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "neutral";

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  success: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  warning: "bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:text-amber-300",
  neutral: "bg-muted text-muted-foreground ring-border"
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

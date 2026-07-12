import { Badge } from "@novachat/ui";
import { cn } from "@novachat/ui";

type StatusTone = "success" | "warning" | "info" | "neutral" | "danger";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
  info: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
  neutral: "bg-muted text-muted-foreground ring-border",
  danger: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300"
};

export function StatusBadge({
  children,
  tone = "neutral",
  className
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <Badge variant="neutral" className={cn(toneClasses[tone], className)}>
      {children}
    </Badge>
  );
}

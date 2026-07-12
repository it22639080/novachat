import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@novachat/ui";
import { cn } from "@novachat/ui";

const tones = {
  blue: "bg-sky-500/10 text-sky-700 ring-sky-500/15 dark:text-sky-300",
  green: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300",
  purple: "bg-violet-500/10 text-violet-700 ring-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:text-amber-300"
} as const;

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "blue"
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1", tones[tone])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-3 truncate text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

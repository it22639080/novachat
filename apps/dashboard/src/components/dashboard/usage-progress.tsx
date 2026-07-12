import { cn } from "@novachat/ui";

const barTones = {
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  purple: "bg-violet-500",
  amber: "bg-amber-500"
} as const;

export function UsageProgress({
  label,
  value,
  max,
  tone = "blue"
}: {
  label: string;
  value: number;
  max: number;
  tone?: keyof typeof barTones;
}) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{percentage}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div className={cn("h-2 rounded-full", barTones[tone])} style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {value.toLocaleString()} of {max.toLocaleString()} used
      </p>
    </div>
  );
}

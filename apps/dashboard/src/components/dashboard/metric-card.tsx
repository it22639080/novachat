import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@novachat/ui";

export function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  accent
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
        <div className={accent}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-normal">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

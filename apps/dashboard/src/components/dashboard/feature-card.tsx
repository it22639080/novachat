import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@novachat/ui";
import { Button } from "@novachat/ui";

export function FeatureCard({
  title,
  description,
  icon: Icon,
  action
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action: string;
}) {
  return (
    <Card className="group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={action}>
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Button>
        </div>
        <h3 className="mt-4 text-sm font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

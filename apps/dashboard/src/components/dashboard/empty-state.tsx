import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@novachat/ui";
import { Card } from "@novachat/ui";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
}) {
  return (
    <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-background">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {actionLabel ? (
        <Button className="mt-5" type="button" variant="outline">
          {actionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </Card>
  );
}

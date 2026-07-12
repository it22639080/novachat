import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";

export function ActivityTimeline({
  items
}: {
  items: readonly { title: string; description: string; time: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity timeline</CardTitle>
        <CardDescription>Recent tenant events and operational signals.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {items.map((item) => (
            <li key={`${item.title}-${item.time}`} className="relative pl-6">
              <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
              <div className="rounded-lg border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

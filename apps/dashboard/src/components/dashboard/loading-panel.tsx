import { Card, CardContent, CardHeader } from "@novachat/ui";
import { Skeleton } from "@novachat/ui";

export function LoadingPanel() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </CardContent>
    </Card>
  );
}

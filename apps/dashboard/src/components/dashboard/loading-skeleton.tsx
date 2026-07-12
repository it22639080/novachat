import { Skeleton } from "@novachat/ui";

export function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading dashboard content">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

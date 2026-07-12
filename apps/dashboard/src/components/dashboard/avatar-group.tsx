import { cn } from "@novachat/ui";

export function AvatarGroup({
  users,
  max = 4
}: {
  users: readonly { name: string; initials: string }[];
  max?: number;
}) {
  const visibleUsers = users.slice(0, max);
  const remaining = Math.max(users.length - max, 0);

  return (
    <div className="flex items-center">
      {visibleUsers.map((user, index) => (
        <div
          key={user.name}
          title={user.name}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-foreground text-xs font-semibold text-background",
            index > 0 && "-ml-2"
          )}
        >
          {user.initials}
        </div>
      ))}
      {remaining > 0 ? (
        <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-semibold text-muted-foreground">
          +{remaining}
        </div>
      ) : null}
    </div>
  );
}

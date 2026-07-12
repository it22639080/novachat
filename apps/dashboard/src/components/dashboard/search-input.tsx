"use client";

import { Search } from "lucide-react";
import { cn } from "@novachat/ui";

export function SearchInput({
  className,
  placeholder = "Search"
}: {
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{placeholder}</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border bg-card px-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </label>
  );
}

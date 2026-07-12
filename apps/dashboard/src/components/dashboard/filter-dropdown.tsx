"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@novachat/ui";

export function FilterDropdown({
  label = "Filter",
  options
}: {
  label?: string;
  options: string[];
}) {
  return (
    <div className="group relative">
      <Button type="button" variant="outline" size="sm" aria-haspopup="menu">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
      <div
        role="menu"
        className="invisible absolute right-0 top-10 z-30 w-48 translate-y-1 rounded-lg border bg-card p-1 opacity-0 shadow-panel transition-all group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitem"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

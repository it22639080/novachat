import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { FilterDropdown } from "./filter-dropdown";
import { SearchInput } from "./search-input";
import { StatusBadge } from "./status-badge";

const statusTone = (value: string) => {
  const normalized = value.toLowerCase();

  if (normalized.includes("active") || normalized.includes("paid") || normalized.includes("live")) {
    return "success";
  }

  if (normalized.includes("pending") || normalized.includes("review") || normalized.includes("agent")) {
    return "warning";
  }

  if (normalized.includes("resolved") || normalized.includes("confirmed") || normalized.includes("healthy")) {
    return "info";
  }

  return "neutral";
};

export function DataTable({
  title,
  description,
  columns,
  rows
}: {
  title: string;
  description?: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput className="w-full sm:w-64" placeholder="Search rows" />
          <FilterDropdown options={["All statuses", "Active", "Needs review"]} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/70 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.join("-")} className="bg-card transition-colors hover:bg-accent/60">
                    {row.map((cell, index) => (
                      <td key={`${cell}-${index}`} className="px-4 py-3">
                        {index === row.length - 1 ? (
                          <StatusBadge tone={statusTone(cell)}>{cell}</StatusBadge>
                        ) : (
                          <span className={index === 0 ? "font-medium" : "text-muted-foreground"}>{cell}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

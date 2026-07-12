import { ArrowRight, Plus } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { DataTable } from "./data-table";
import { EmptyState } from "./empty-state";
import { FeatureCard } from "./feature-card";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { UsageProgress } from "./usage-progress";
import { featurePages } from "@/lib/dashboard-mock-data";

type FeatureKey = keyof typeof featurePages;

export function FeaturePage({ feature }: { feature: FeatureKey }) {
  const config = featurePages[feature];
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        action={
          <Button type="button">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {config.action}
          </Button>
        }
        meta={
          <>
            <StatusBadge tone="success">Tenant scoped</StatusBadge>
            <StatusBadge tone="info">Mock UI data</StatusBadge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <DataTable
          title={config.tableTitle}
          description="Placeholder data is isolated in dashboard-mock-data.ts until real APIs are connected."
          columns={config.columns}
          rows={config.rows}
        />

        <div className="space-y-4">
          <FeatureCard
            icon={Icon}
            title={config.emptyTitle}
            description={config.emptyDescription}
            action={config.action}
          />
          <Card>
            <CardHeader>
              <CardTitle>Readiness</CardTitle>
              <CardDescription>UI-only operational preview for this module.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageProgress label="Configuration" value={68} max={100} tone="blue" />
              <UsageProgress label="Data coverage" value={42} max={100} tone="green" />
              <Button type="button" variant="outline" className="w-full">
                View setup path
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <EmptyState
        icon={Icon}
        title={config.emptyTitle}
        description={config.emptyDescription}
        actionLabel={config.action}
      />
    </div>
  );
}

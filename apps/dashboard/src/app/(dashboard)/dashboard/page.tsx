import { ArrowRight, Bot, MessageSquareText, Plus, ShoppingBag } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@novachat/ui";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { AvatarGroup } from "@/components/dashboard/avatar-group";
import { ChartCard } from "@/components/dashboard/chart-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FeatureCard } from "@/components/dashboard/feature-card";
import { LoadingSkeleton } from "@/components/dashboard/loading-skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { UsageProgress } from "@/components/dashboard/usage-progress";
import {
  activityTimeline,
  overviewStats,
  pipelineStages,
  recentConversations,
  salesChartData,
  teamAvatars
} from "@/lib/dashboard-mock-data";

export default function DashboardPage() {
  const totalPipeline = pipelineStages.reduce((sum, stage) => sum + stage.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Business command center"
        description="Monitor WhatsApp conversations, AI coverage, lead movement, revenue, bookings, campaigns, and tenant health from one premium workspace."
        action={
          <Button type="button">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Connect WhatsApp
          </Button>
        }
        meta={
          <>
            <StatusBadge tone="info">UI placeholder data</StatusBadge>
            <StatusBadge tone="success">Tenant isolated</StatusBadge>
            <AvatarGroup users={teamAvatars} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <ChartCard
          title="Sales chart"
          description="Revenue, conversations, and lead momentum from mock tenant activity."
          data={salesChartData}
        />

        <Card>
          <CardHeader>
            <CardTitle>Lead pipeline summary</CardTitle>
            <CardDescription>Stage distribution for the active tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pipelineStages.map((stage) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.label}</span>
                  <span className="text-muted-foreground">{stage.value} leads</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className={`${stage.color} h-2 rounded-full`}
                    style={{ width: `${Math.round((stage.value / totalPipeline) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader className="md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Recent conversations</CardTitle>
              <CardDescription>Latest tenant inbox activity with AI and agent state.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm">
              Open inbox
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentConversations.map((conversation) => (
              <div
                key={`${conversation.customer}-${conversation.time}`}
                className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{conversation.customer}</p>
                    <StatusBadge
                      tone={
                        conversation.status === "AI active"
                          ? "success"
                          : conversation.status === "Needs agent"
                            ? "warning"
                            : "info"
                      }
                    >
                      {conversation.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{conversation.summary}</p>
                </div>
                <div className="shrink-0 text-sm text-muted-foreground">
                  {conversation.channel} / {conversation.time}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign performance</CardTitle>
              <CardDescription>Preview of active broadcast quality and conversion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageProgress label="Delivery rate" value={9420} max={10000} tone="green" />
              <UsageProgress label="Click-through" value={314} max={1000} tone="blue" />
              <UsageProgress label="Revenue attribution" value={48200} max={75000} tone="purple" />
            </CardContent>
          </Card>
          <ActivityTimeline items={activityTimeline} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FeatureCard
          icon={Bot}
          title="AI assistant readiness"
          description="Tune assistant policy, approved knowledge, and confidence thresholds before live automation."
          action="Configure AI"
        />
        <FeatureCard
          icon={MessageSquareText}
          title="Inbox operations"
          description="Balance AI coverage with team handoffs, response time, and priority conversation queues."
          action="Open inbox"
        />
        <FeatureCard
          icon={ShoppingBag}
          title="Commerce intelligence"
          description="Track products, orders, checkout flow, and revenue captured from customer conversations."
          action="View orders"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EmptyState
          icon={Bot}
          title="No live assistant connected"
          description="This panel intentionally uses mock UI data until AI assistant APIs are connected in a later phase."
          actionLabel="Create assistant"
        />
        <LoadingSkeleton />
      </div>
    </div>
  );
}

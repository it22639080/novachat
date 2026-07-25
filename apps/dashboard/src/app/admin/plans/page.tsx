import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminPlansPage() {
  return (
    <AdminCollectionPage
      title="Plans"
      description="Create and manage SaaS packages, feature flags, and tenant limits."
      endpoint="/admin/plans"
      collectionKeys={["plans", "items"]}
      searchable={false}
      statusFilter={false}
      actions="plans"
    />
  );
}

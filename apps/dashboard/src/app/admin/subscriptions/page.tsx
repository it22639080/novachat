import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminSubscriptionsPage() {
  return (
    <AdminCollectionPage
      title="Subscriptions"
      description="Review trial, active, past-due, suspended, cancelled, and expired tenant subscriptions."
      endpoint="/admin/subscriptions"
      collectionKeys={["items", "subscriptions"]}
    />
  );
}

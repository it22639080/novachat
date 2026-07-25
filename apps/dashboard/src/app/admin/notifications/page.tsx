import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminNotificationsPage() {
  return (
    <AdminCollectionPage
      title="Notifications"
      description="View platform notifications for registrations, payments, subscription risks, usage thresholds, and failures."
      endpoint="/admin/notifications"
      collectionKeys={["items", "notifications"]}
    />
  );
}

import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminUsagePage() {
  return (
    <AdminCollectionPage
      title="Usage"
      description="Monitor AI replies, token consumption, WhatsApp messages, storage, and limit pressure by tenant."
      endpoint="/admin/usage"
      collectionKeys={["tenants", "recentRecords"]}
      searchable={false}
      statusFilter={false}
    />
  );
}

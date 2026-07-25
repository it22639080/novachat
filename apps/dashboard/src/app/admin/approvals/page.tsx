import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminApprovalsPage() {
  return (
    <AdminCollectionPage
      title="Account approvals"
      description="Approve, reject, or suspend newly verified tenant accounts before dashboard access is granted."
      endpoint="/admin/approvals"
      collectionKeys={["items", "tenants"]}
      statusFilter={false}
      actions="approvals"
    />
  );
}

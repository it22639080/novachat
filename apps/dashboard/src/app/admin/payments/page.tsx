import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminPaymentsPage() {
  return (
    <AdminCollectionPage
      title="Payments"
      description="Review manual bank payments, approve receipts, and activate subscriptions."
      endpoint="/admin/payments"
      collectionKeys={["items", "payments"]}
      actions="payments"
    />
  );
}

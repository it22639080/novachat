import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminInvoicesPage() {
  return (
    <AdminCollectionPage
      title="Invoices"
      description="Track generated invoices, totals, due dates, paid status, and overdue accounts."
      endpoint="/admin/invoices"
      collectionKeys={["items", "invoices"]}
    />
  );
}

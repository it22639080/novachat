import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminAuditLogsPage() {
  return (
    <AdminCollectionPage
      title="Audit logs"
      description="Inspect every important admin and tenant action recorded for compliance."
      endpoint="/admin/audit-logs"
      collectionKeys={["items", "auditLogs"]}
      statusFilter={false}
    />
  );
}

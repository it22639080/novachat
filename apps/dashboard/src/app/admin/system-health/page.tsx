import { AdminDetailPage } from "@/components/admin/admin-detail-page";

export default function AdminSystemHealthPage() {
  return (
    <AdminDetailPage
      title="System health"
      description="Check database, queues, WhatsApp connectivity, failed AI logs, and platform health."
      endpoint="/admin/system-health"
    />
  );
}

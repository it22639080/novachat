import { AdminDetailPage } from "@/components/admin/admin-detail-page";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AdminDetailPage
      title="User detail"
      description="Review account, tenant, subscription, payment, usage, WhatsApp, and audit context."
      endpoint={`/admin/users/${id}`}
    />
  );
}

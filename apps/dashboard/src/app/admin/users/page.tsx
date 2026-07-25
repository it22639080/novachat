import { AdminCollectionPage } from "@/components/admin/admin-collection-page";

export default function AdminUsersPage() {
  return (
    <AdminCollectionPage
      title="Users"
      description="Manage owners, admins, staff, tenant memberships, plans, and account access."
      endpoint="/admin/users"
      collectionKeys={["items", "users"]}
      actions="users"
    />
  );
}

import { prisma } from "@novachat/database";
import type { PlatformRole } from "@novachat/shared-types";

const ownerPermissions = [
  "tenant.manage",
  "members.manage",
  "conversations.read",
  "conversations.reply",
  "crm.manage",
  "commerce.manage",
  "campaigns.manage",
  "ai.manage"
];

export class PermissionService {
  async permissionsForRole(role: PlatformRole) {
    if (role === "SUPER_ADMIN") {
      return ["*"];
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role },
      select: {
        permission: {
          select: { key: true }
        }
      }
    });

    if (rolePermissions.length > 0) {
      return rolePermissions.map((item) => item.permission.key);
    }

    if (role === "OWNER" || role === "ADMIN") {
      return ownerPermissions;
    }

    if (role === "MANAGER") {
      return ["conversations.read", "conversations.reply", "crm.manage", "campaigns.manage"];
    }

    if (role === "AGENT") {
      return ["conversations.read", "conversations.reply"];
    }

    return ["conversations.read"];
  }

  hasPermission(permissions: string[] | undefined, required: string) {
    return permissions?.includes("*") || permissions?.includes(required) || false;
  }
}

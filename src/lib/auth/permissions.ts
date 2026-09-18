import "server-only";
import { Role } from "@prisma/client";

export type Permission =
  | "catalog.read"
  | "catalog.write"
  | "orders.read"
  | "orders.update"
  | "customers.read"
  | "customers.update"
  | "settings.write"
  | "system.manage";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.GUEST]: ["catalog.read"],
  [Role.CUSTOMER]: ["catalog.read"],
  [Role.STORE_ADMIN]: [
    "catalog.read",
    "catalog.write",
    "orders.read",
    "orders.update",
    "customers.read",
    "customers.update",
  ],
  [Role.SUPER_ADMIN]: [
    "catalog.read",
    "catalog.write",
    "orders.read",
    "orders.update",
    "customers.read",
    "customers.update",
    "settings.write",
    "system.manage",
  ],
};

/**
 * Check if a given role possesses a specific permission capability.
 * Serves as the foundation for future fine-grained capabilities.
 */
export function hasPermission(role: Role | string | undefined, permission: Permission): boolean {
  if (!role) {
    return ROLE_PERMISSIONS[Role.GUEST].includes(permission);
  }
  const appRole = role as Role;
  const permissions = ROLE_PERMISSIONS[appRole] || [];
  return permissions.includes(permission);
}

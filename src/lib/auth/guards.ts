import "server-only";
import { Role } from "@prisma/client";
import { getCurrentUser, CurrentUser } from "./session";
import { AuthError, ForbiddenError } from "../errors";

/**
 * Require an authenticated session.
 * Throws AuthError (401) if user is unauthenticated or missing valid ID.
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new AuthError("Authentication required to perform this action");
  }
  return user;
}

/**
 * Require user to possess specific role or one of multiple allowed roles.
 * Throws AuthError (401) if unauthenticated, or ForbiddenError (403) if role unauthorized.
 */
export async function requireRole(allowedRoles: Role | Role[]): Promise<CurrentUser> {
  const user = await requireAuth();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  const userRole = (user.role as Role) || Role.CUSTOMER;
  if (!roles.includes(userRole)) {
    throw new ForbiddenError("Access denied");
  }

  return user;
}

/**
 * Helper to require any of the specified roles.
 */
export async function requireAnyRole(allowedRoles: Role[]): Promise<CurrentUser> {
  return requireRole(allowedRoles);
}

/**
 * Require store administrator role (STORE_ADMIN or SUPER_ADMIN).
 */
export async function requireAdmin(): Promise<CurrentUser> {
  return requireRole([Role.STORE_ADMIN, Role.SUPER_ADMIN]);
}

/**
 * Require super administrator role (SUPER_ADMIN only).
 */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  return requireRole(Role.SUPER_ADMIN);
}

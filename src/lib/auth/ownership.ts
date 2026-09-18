import "server-only";
import { Role } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../errors";

export interface OwnershipParams {
  resourceUserId: string;
  sessionUserId: string;
  userRole?: Role | string;
  hideExistenceOnForbidden?: boolean;
}

/**
 * Validates whether a user owns a resource or possesses administrative role overrides.
 * Protects against Insecure Direct Object References (IDOR).
 *
 * Rules:
 * - CUSTOMER: Can access resource ONLY if resourceUserId === sessionUserId.
 * - STORE_ADMIN / SUPER_ADMIN: Granted access for store operational/system duties.
 * - Unmatched Ownership: Throws ForbiddenError (403) or NotFoundError (404 if hideExistenceOnForbidden is enabled).
 */
export function requireOwnership({
  resourceUserId,
  sessionUserId,
  userRole = Role.CUSTOMER,
  hideExistenceOnForbidden = false,
}: OwnershipParams): boolean {
  if (!sessionUserId) {
    throw new ForbiddenError("Access denied");
  }

  // Administrative role override
  if (userRole === Role.STORE_ADMIN || userRole === Role.SUPER_ADMIN) {
    return true;
  }

  // Strict owner identity matching
  if (resourceUserId === sessionUserId) {
    return true;
  }

  // Handle unauthorized resource access attempt
  if (hideExistenceOnForbidden) {
    throw new NotFoundError("Requested resource not found");
  }

  throw new ForbiddenError("Access denied");
}

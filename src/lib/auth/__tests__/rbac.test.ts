import { Role } from "@prisma/client";
import { AuthError, ForbiddenError, NotFoundError } from "../../errors";
import { requireOwnership } from "../ownership";
import { hasPermission } from "../permissions";
import { isValidRole, sanitizeClientUserInput } from "../user-service";
import { requireAuth, requireRole, requireAdmin, requireSuperAdmin } from "../guards";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runRbacSelfTest() {
  console.log("--> Running Phase 03.02 Server RBAC Guards & Resource Ownership self-tests...");

  // 1. Guard Functions Verification & Unauthenticated Checks
  assert(typeof requireAuth === "function", "requireAuth guard exported");
  assert(typeof requireRole === "function", "requireRole guard exported");
  assert(typeof requireAdmin === "function", "requireAdmin guard exported");
  assert(typeof requireSuperAdmin === "function", "requireSuperAdmin guard exported");

  let unauthenticatedBlocked = false;
  try {
    await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      unauthenticatedBlocked = true;
      assert(err.statusCode === 401, "Unauthenticated guard must return 401 status code");
      assert(err.code === "UNAUTHENTICATED", "Unauthenticated guard code must be UNAUTHENTICATED");
    }
  }
  assert(unauthenticatedBlocked === true, "Unauthenticated user must be blocked by requireAuth");

  // 2. Resource Ownership & IDOR Protection Tests
  const customerA = "usr_cust_A_101";
  const customerB = "usr_cust_B_202";
  const storeAdmin = "usr_admin_303";
  const superAdmin = "usr_super_404";

  // Customer A accesses own resource -> Allowed
  const isOwner = requireOwnership({
    resourceUserId: customerA,
    sessionUserId: customerA,
    userRole: Role.CUSTOMER,
  });
  assert(isOwner === true, "Customer A must access own resource");

  // Customer A attempts IDOR access on Customer B resource -> 403 Forbidden
  let idorBlocked = false;
  try {
    requireOwnership({
      resourceUserId: customerB,
      sessionUserId: customerA,
      userRole: Role.CUSTOMER,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      idorBlocked = true;
      assert(err.statusCode === 403, "IDOR attempt must result in 403 status code");
      assert(err.code === "FORBIDDEN", "IDOR attempt error code must be FORBIDDEN");
    }
  }
  assert(idorBlocked === true, "Customer A must be blocked from accessing Customer B resource");

  // Customer A attempts IDOR with hideExistenceOnForbidden -> 404 NotFound
  let idorHidden = false;
  try {
    requireOwnership({
      resourceUserId: customerB,
      sessionUserId: customerA,
      userRole: Role.CUSTOMER,
      hideExistenceOnForbidden: true,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      idorHidden = true;
      assert(err.statusCode === 404, "Hidden IDOR attempt must result in 404 status code");
      assert(err.code === "NOT_FOUND", "Hidden IDOR attempt error code must be NOT_FOUND");
    }
  }
  assert(idorHidden === true, "Customer A must receive 404 when hideExistenceOnForbidden is true");

  // Store Admin accesses customer resource -> Allowed (Operational Override)
  const adminOverride = requireOwnership({
    resourceUserId: customerB,
    sessionUserId: storeAdmin,
    userRole: Role.STORE_ADMIN,
  });
  assert(adminOverride === true, "Store Admin must be granted operational access to customer resource");

  // Super Admin accesses customer resource -> Allowed (Management Override)
  const superOverride = requireOwnership({
    resourceUserId: customerB,
    sessionUserId: superAdmin,
    userRole: Role.SUPER_ADMIN,
  });
  assert(superOverride === true, "Super Admin must be granted administrative access to customer resource");

  // 3. Permission Matrix Capability Tests
  assert(hasPermission(Role.GUEST, "catalog.read") === true, "Guest can read catalog");
  assert(hasPermission(Role.GUEST, "catalog.write") === false, "Guest cannot write catalog");
  assert(hasPermission(Role.CUSTOMER, "catalog.read") === true, "Customer can read catalog");
  assert(hasPermission(Role.CUSTOMER, "catalog.write") === false, "Customer cannot write catalog");
  assert(hasPermission(Role.STORE_ADMIN, "catalog.write") === true, "Store Admin can write catalog");
  assert(hasPermission(Role.STORE_ADMIN, "system.manage") === false, "Store Admin cannot manage system");
  assert(hasPermission(Role.SUPER_ADMIN, "system.manage") === true, "Super Admin can manage system");

  // 4. Privilege Escalation & Role Sanitization Tests
  const forgedPayload = {
    email: "user@example.com",
    role: "SUPER_ADMIN",
    status: "SUSPENDED",
  };

  const cleanPayload = sanitizeClientUserInput(forgedPayload);
  assert(!("role" in cleanPayload), "Sanitized payload must strip client role field");
  assert(!("status" in cleanPayload), "Sanitized payload must strip client status field");
  assert(isValidRole("INVALID_ROLE") === false, "Invalid role string must be rejected");

  console.log("✓ All Phase 03.02 Server RBAC Guards & Resource Ownership self-tests passed cleanly!");
}

runRbacSelfTest().catch((err) => {
  console.error("RBAC self-test failed:", err);
  process.exit(1);
});

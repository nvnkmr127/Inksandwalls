import { Role, UserStatus } from "@prisma/client";
import { authConfig } from "../auth.config";
import { getCurrentUser, isAuthenticated, isGuest } from "../session";
import {
  isValidRole,
  sanitizeClientUserInput,
  findOrCreateUserByPhone,
  findOrCreateUserByEmail,
  VALID_ROLES,
} from "../user-service";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runUserRolesSelfTest() {
  console.log("--> Running Phase 03.01 User / Customer Model & Roles self-tests...");

  // 1. Role Enum & Constants Validation
  assert(Role.GUEST === "GUEST", "Role GUEST enum value check");
  assert(Role.CUSTOMER === "CUSTOMER", "Role CUSTOMER enum value check");
  assert(Role.STORE_ADMIN === "STORE_ADMIN", "Role STORE_ADMIN enum value check");
  assert(Role.SUPER_ADMIN === "SUPER_ADMIN", "Role SUPER_ADMIN enum value check");

  assert(UserStatus.ACTIVE === "ACTIVE", "UserStatus ACTIVE enum value check");
  assert(UserStatus.SUSPENDED === "SUSPENDED", "UserStatus SUSPENDED enum value check");
  assert(Array.isArray(VALID_ROLES) && VALID_ROLES.length === 4, "VALID_ROLES must contain 4 roles");
  assert(typeof findOrCreateUserByPhone === "function", "findOrCreateUserByPhone helper exported");
  assert(typeof findOrCreateUserByEmail === "function", "findOrCreateUserByEmail helper exported");

  // 2. Role Validation & Rejection
  assert(isValidRole("GUEST") === true, "GUEST should be valid role");
  assert(isValidRole("CUSTOMER") === true, "CUSTOMER should be valid role");
  assert(isValidRole("STORE_ADMIN") === true, "STORE_ADMIN should be valid role");
  assert(isValidRole("SUPER_ADMIN") === true, "SUPER_ADMIN should be valid role");
  assert(isValidRole("ROOT_ADMIN") === false, "ROOT_ADMIN should be invalid role");
  assert(isValidRole(123) === false, "Non-string role should be invalid role");
  assert(isValidRole(null) === false, "Null role should be invalid role");

  // 3. Client Payload Security Sanitization
  const maliciousInput = {
    name: "Hacker",
    email: "hacker@example.com",
    role: "SUPER_ADMIN",
    status: "SUSPENDED",
    id: "override_id",
    createdAt: new Date(),
  };

  const sanitized = sanitizeClientUserInput(maliciousInput);
  assert(!("role" in sanitized), "Sanitized payload must not contain role");
  assert(!("status" in sanitized), "Sanitized payload must not contain status");
  assert(!("id" in sanitized), "Sanitized payload must not contain id");
  assert(!("createdAt" in sanitized), "Sanitized payload must not contain createdAt");
  assert(sanitized.name === "Hacker", "Sanitized payload preserves safe user name");
  assert(sanitized.email === "hacker@example.com", "Sanitized payload preserves safe user email");

  // 4. Auth.js Session Foundation Integration & Types
  assert(authConfig.session?.strategy === "jwt", "Auth.js strategy must remain 'jwt'");

  if (authConfig.callbacks?.jwt) {
    const updatedToken = await authConfig.callbacks.jwt({
      token: { sub: "usr_test123" },
      user: { id: "usr_test123", role: Role.CUSTOMER, status: UserStatus.ACTIVE, phone: "+919876543210" },
      account: null,
    });
    assert(updatedToken?.role === "CUSTOMER", "JWT token correctly sets CUSTOMER role");
  }

  if (authConfig.callbacks?.session) {
    type SessionParam = Parameters<NonNullable<typeof authConfig.callbacks.session>>[0];
    const sessionInput = {
      user: { id: "", name: "Test Customer", email: "customer@example.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };
    const sessionOutput = await authConfig.callbacks.session({
      session: sessionInput as unknown as SessionParam["session"],
      token: { sub: "usr_test123", role: Role.CUSTOMER, phone: "+919876543210" },
      user: { id: "usr_test123" } as unknown as SessionParam["user"],
      newSession: null,
      trigger: "update",
    });
    assert(sessionOutput?.user?.role === "CUSTOMER", "Session callback maps role");
  }

  // 5. Unauthenticated Guest Verification
  const user = await getCurrentUser();
  assert(user === null, "getCurrentUser should return null for guest");

  const authed = await isAuthenticated();
  assert(authed === false, "isAuthenticated should return false for guest");

  const guest = await isGuest();
  assert(guest === true, "isGuest should return true for guest shopper");

  console.log("✓ All Phase 03.01 User / Customer Model & Roles self-tests passed cleanly!");
}

runUserRolesSelfTest().catch((err) => {
  console.error("User roles self-test failed:", err);
  process.exit(1);
});

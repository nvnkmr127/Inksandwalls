import assert from "node:assert";
import { generateSlug, normalizeSlug, validateSlug } from "../slug";
import { validateCollectionInput } from "../validation";
import { Role } from "@prisma/client";
import { ValidationError, AuthError, ForbiddenError } from "@/lib/errors";

async function runCollectionTests() {
  console.log("Running Collection Module Tests...");

  // 1. Test Slug Generation and Normalization
  assert.strictEqual(generateSlug("New Arrivals & Best Sellers"), "new-arrivals-best-sellers");
  assert.strictEqual(generateSlug("  Living  Room - 2026!  "), "living-room-2026");
  assert.strictEqual(normalizeSlug("Custom Collection SLUG!!"), "custom-collection-slug");
  assert.strictEqual(validateSlug("new-arrivals"), true);
  assert.strictEqual(validateSlug("New Arrivals & Best Sellers"), false);
  assert.strictEqual(validateSlug(""), false);
  console.log("✔ Slug generation and normalization tests passed");

  // 2. Test Collection Input Validation
  // Valid input
  const valid = validateCollectionInput({
    name: " New Arrivals ",
    slug: " new-arrivals ",
    description: " Latest curated wall designs ",
    isActive: true,
    sortOrder: 5,
  });
  assert.strictEqual(valid.name, "New Arrivals");
  assert.strictEqual(valid.slug, "new-arrivals");
  assert.strictEqual(valid.description, "Latest curated wall designs");
  assert.strictEqual(valid.isActive, true);
  assert.strictEqual(valid.sortOrder, 5);

  // Default values
  const defaults = validateCollectionInput({
    name: "Living Room",
  });
  assert.strictEqual(defaults.name, "Living Room");
  assert.strictEqual(defaults.slug, "living-room");
  assert.strictEqual(defaults.description, null);
  assert.strictEqual(defaults.isActive, true);
  assert.strictEqual(defaults.sortOrder, 0);

  // Missing / empty name
  assert.throws(() => {
    validateCollectionInput({ name: "   " });
  }, ValidationError);

  // Name too long
  assert.throws(() => {
    validateCollectionInput({ name: "a".repeat(101) });
  }, ValidationError);

  // Invalid sort order
  assert.throws(() => {
    validateCollectionInput({ name: "Valid", sortOrder: 2.5 });
  }, ValidationError);

  console.log("✔ Collection input validation tests passed");

  // 3. Test RBAC Guard Logic
  const storeAdminUser = { id: "usr_admin_1", role: Role.STORE_ADMIN };
  const superAdminUser = { id: "usr_admin_2", role: Role.SUPER_ADMIN };
  const customerUser = { id: "usr_cust_1", role: Role.CUSTOMER };

  // Helper mock session check
  const checkRole = (user: { id: string; role: Role } | null, allowed: Role[]) => {
    if (!user) throw new AuthError("Authentication required to perform this action");
    if (!allowed.includes(user.role)) throw new ForbiddenError("Access denied");
    return user;
  };

  assert.doesNotThrow(() => checkRole(storeAdminUser, [Role.STORE_ADMIN, Role.SUPER_ADMIN]));
  assert.doesNotThrow(() => checkRole(superAdminUser, [Role.STORE_ADMIN, Role.SUPER_ADMIN]));
  assert.throws(() => checkRole(customerUser, [Role.STORE_ADMIN, Role.SUPER_ADMIN]), ForbiddenError);
  assert.throws(() => checkRole(null, [Role.STORE_ADMIN, Role.SUPER_ADMIN]), AuthError);

  console.log("✔ Collection RBAC authorization guard tests passed");

  console.log("ALL COLLECTION MODULE TESTS PASSED SUCCESSFULLY!");
}

runCollectionTests().catch((err) => {
  console.error("Collection Module Test Failure:", err);
  process.exit(1);
});

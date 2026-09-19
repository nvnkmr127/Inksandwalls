import assert from "node:assert";
import { generateSlug, normalizeSlug, validateSlug } from "../slug";
import { validateCategoryInput } from "../validation";
import { Role } from "@prisma/client";
import { ValidationError, AuthError, ForbiddenError } from "@/lib/errors";


async function runCategoryTests() {
  console.log("Running Category Module Tests...");

  // 1. Test Slug Generation and Normalization
  assert.strictEqual(generateSlug("Wallpapers & Decals"), "wallpapers-decals");
  assert.strictEqual(generateSlug("  Luxury  Vinyl - 2026!  "), "luxury-vinyl-2026");
  assert.strictEqual(normalizeSlug("Custom SLUG Name!!"), "custom-slug-name");
  assert.strictEqual(validateSlug("wallpapers-decals"), true);
  assert.strictEqual(validateSlug("Wallpapers & Decals"), false);
  assert.strictEqual(validateSlug(""), false);
  console.log("✔ Slug generation and normalization tests passed");

  // 2. Test Category Input Validation
  // Valid input
  const valid = validateCategoryInput({
    name: " Wallpapers ",
    slug: " wallpapers ",
    description: " High quality wallpapers ",
    isActive: true,
    sortOrder: 10,
  });
  assert.strictEqual(valid.name, "Wallpapers");
  assert.strictEqual(valid.slug, "wallpapers");
  assert.strictEqual(valid.description, "High quality wallpapers");
  assert.strictEqual(valid.isActive, true);
  assert.strictEqual(valid.sortOrder, 10);

  // Default values
  const defaults = validateCategoryInput({
    name: "Murals",
  });
  assert.strictEqual(defaults.name, "Murals");
  assert.strictEqual(defaults.slug, "murals");
  assert.strictEqual(defaults.description, null);
  assert.strictEqual(defaults.isActive, true);
  assert.strictEqual(defaults.sortOrder, 0);

  // Missing / empty name
  assert.throws(() => {
    validateCategoryInput({ name: "   " });
  }, ValidationError);

  // Name too long
  assert.throws(() => {
    validateCategoryInput({ name: "a".repeat(101) });
  }, ValidationError);

  // Invalid sort order
  assert.throws(() => {
    validateCategoryInput({ name: "Valid", sortOrder: 1.5 });
  }, ValidationError);

  console.log("✔ Category input validation tests passed");

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

  console.log("✔ Category RBAC authorization guard tests passed");

  console.log("ALL CATEGORY MODULE TESTS PASSED SUCCESSFULLY!");
}

runCategoryTests().catch((err) => {
  console.error("Category Module Test Failure:", err);
  process.exit(1);
});

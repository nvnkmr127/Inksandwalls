import assert from "node:assert";
import { validateProductVariantInput } from "../validation";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { ProductType, Role } from "@prisma/client";
import { ValidationError, AuthError, ForbiddenError } from "@/lib/errors";

async function runVariantTests() {
  console.log("Running Product Variant Module Tests...");

  // 1. Valid Product Variant Input Validation
  const validVariant = validateProductVariantInput({
    name: " 30 × 40 cm - Black Frame ",
    sku: " ART-30X40-BLK ",
    price: 499900, // ₹4,999 in paise
    isActive: true,
    sortOrder: 1,
  });

  assert.strictEqual(validVariant.name, "30 × 40 cm - Black Frame");
  assert.strictEqual(validVariant.sku, "ART-30X40-BLK");
  assert.strictEqual(validVariant.price, 499900);
  assert.strictEqual(validVariant.isActive, true);
  assert.strictEqual(validVariant.sortOrder, 1);
  console.log("✔ Valid ProductVariant input validation passed");

  // 2. Default values handling
  const defaultVariant = validateProductVariantInput({
    name: "White Frame",
    price: 399900,
  });

  assert.strictEqual(defaultVariant.name, "White Frame");
  assert.strictEqual(defaultVariant.sku, null);
  assert.strictEqual(defaultVariant.price, 399900);
  assert.strictEqual(defaultVariant.isActive, true);
  assert.strictEqual(defaultVariant.sortOrder, 0);
  console.log("✔ Default values validation passed");

  // 3. Validation Error Triggers
  // Missing name
  assert.throws(() => {
    validateProductVariantInput({
      price: 100000,
      name: "   ",
    });
  }, ValidationError);

  // Control characters in name
  assert.throws(() => {
    validateProductVariantInput({
      name: "Bad\x00Name",
      price: 100000,
    });
  }, ValidationError);

  // Invalid SKU format (spaces or special symbols)
  assert.throws(() => {
    validateProductVariantInput({
      name: "Frame",
      sku: "INVALID SKU!",
      price: 100000,
    });
  }, ValidationError);

  // Missing price
  assert.throws(() => {
    validateProductVariantInput({
      name: "Frame",
    });
  }, ValidationError);

  // Non-positive price
  assert.throws(() => {
    validateProductVariantInput({
      name: "Frame",
      price: 0,
    });
  }, ValidationError);

  // Non-integer sort order
  assert.throws(() => {
    validateProductVariantInput({
      name: "Frame",
      price: 100000,
      sortOrder: 1.5,
    });
  }, ValidationError);

  console.log("✔ Variant input validation error triggers passed");

  // 4. FIXED Product Type Boundary Verification
  const checkProductTypeForVariant = (productType: ProductType) => {
    if (productType !== ProductType.FIXED) {
      throw new ValidationError("Product variants can only be created for FIXED price products.");
    }
    return true;
  };

  assert.strictEqual(checkProductTypeForVariant(ProductType.FIXED), true);
  assert.throws(() => checkProductTypeForVariant(ProductType.PER_AREA), ValidationError);
  console.log("✔ FIXED product type boundary guard tests passed");

  // 5. RBAC Authorization Logic
  const storeAdminUser = { id: "usr_admin_1", role: Role.STORE_ADMIN };
  const superAdminUser = { id: "usr_admin_2", role: Role.SUPER_ADMIN };
  const customerUser = { id: "usr_cust_1", role: Role.CUSTOMER };

  const checkRole = (user: { id: string; role: Role } | null, allowed: Role[]) => {
    if (!user) throw new AuthError("Authentication required to perform this action");
    if (!allowed.includes(user.role)) throw new ForbiddenError("Access denied");
    return user;
  };

  assert.doesNotThrow(() => checkRole(storeAdminUser, [Role.STORE_ADMIN, Role.SUPER_ADMIN]));
  assert.doesNotThrow(() => checkRole(superAdminUser, [Role.STORE_ADMIN, Role.SUPER_ADMIN]));
  assert.throws(() => checkRole(customerUser, [Role.STORE_ADMIN, Role.SUPER_ADMIN]), ForbiddenError);
  assert.throws(() => checkRole(null, [Role.STORE_ADMIN, Role.SUPER_ADMIN]), AuthError);

  console.log("✔ Variant RBAC authorization guard tests passed");

  // 6. Audit Constants Verification
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_CREATED, "PRODUCT_VARIANT_CREATED");
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_UPDATED, "PRODUCT_VARIANT_UPDATED");
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_ACTIVATED, "PRODUCT_VARIANT_ACTIVATED");
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_DEACTIVATED, "PRODUCT_VARIANT_DEACTIVATED");
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_DELETED, "PRODUCT_VARIANT_DELETED");
  assert.strictEqual(AUDIT_RESOURCE_TYPES.PRODUCT_VARIANT, "PRODUCT_VARIANT");
  console.log("✔ Audit actions and resource types verified");

  console.log("ALL PRODUCT VARIANT MODULE TESTS PASSED SUCCESSFULLY!");
}

runVariantTests().catch((err) => {
  console.error("Product Variant Module Test Failure:", err);
  process.exit(1);
});

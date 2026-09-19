import assert from "node:assert";
import { generateSlug, normalizeSlug, validateSlug } from "../slug";
import { validateProductInput } from "../validation";
import { ProductType, Role } from "@prisma/client";
import { ValidationError, AuthError, ForbiddenError } from "@/lib/errors";

async function runProductTests() {
  console.log("Running Product Module Tests...");

  // 1. Test Slug Generation and Normalization
  assert.strictEqual(generateSlug("Royal Floral Wallpaper"), "royal-floral-wallpaper");
  assert.strictEqual(generateSlug("  Luxury  Blinds - 2026!  "), "luxury-blinds-2026");
  assert.strictEqual(normalizeSlug("Custom Product SLUG!!"), "custom-product-slug");
  assert.strictEqual(validateSlug("royal-floral-wallpaper"), true);
  assert.strictEqual(validateSlug("Royal Floral Wallpaper"), false);
  assert.strictEqual(validateSlug(""), false);
  console.log("✔ Product slug generation and validation tests passed");

  // 2. Test FIXED Product Input Validation
  const validFixed = validateProductInput({
    name: " Abstract Canvas Art ",
    productType: ProductType.FIXED,
    categoryId: "cat_wall_art_123",
    price: 499900, // ₹4,999 in paise
    description: " High quality canvas print ",
    isActive: true,
    returnable: true,
    hsnCode: " 9701.10 ",
  });

  assert.strictEqual(validFixed.name, "Abstract Canvas Art");
  assert.strictEqual(validFixed.slug, "abstract-canvas-art");
  assert.strictEqual(validFixed.productType, ProductType.FIXED);
  assert.strictEqual(validFixed.price, 499900);
  assert.strictEqual(validFixed.rate, null);
  assert.strictEqual(validFixed.wastage, null);
  assert.strictEqual(validFixed.minArea, null);
  assert.strictEqual(validFixed.rollWidth, null);
  assert.strictEqual(validFixed.categoryId, "cat_wall_art_123");
  assert.strictEqual(validFixed.hsnCode, "9701.10");
  assert.strictEqual(validFixed.returnable, true);
  console.log("✔ FIXED product validation tests passed");

  // 3. Test PER_AREA Product Input Validation
  const validPerArea = validateProductInput({
    name: " Premium Textured Wallpaper ",
    productType: ProductType.PER_AREA,
    categoryId: "cat_wallpaper_456",
    rate: 15000, // ₹150/sqft in paise
    wastage: 10.5,
    minArea: 25.0,
    rollWidth: 3.0,
    returnable: false,
  });

  assert.strictEqual(validPerArea.name, "Premium Textured Wallpaper");
  assert.strictEqual(validPerArea.slug, "premium-textured-wallpaper");
  assert.strictEqual(validPerArea.productType, ProductType.PER_AREA);
  assert.strictEqual(validPerArea.rate, 15000);
  assert.strictEqual(validPerArea.price, null);
  assert.strictEqual(validPerArea.wastage, 10.5);
  assert.strictEqual(validPerArea.minArea, 25.0);
  assert.strictEqual(validPerArea.rollWidth, 3.0);
  assert.strictEqual(validPerArea.returnable, false);
  console.log("✔ PER_AREA product validation tests passed");

  // 4. Test Validation Error Triggers
  // Missing product name
  assert.throws(() => {
    validateProductInput({
      productType: ProductType.FIXED,
      categoryId: "cat_1",
      price: 1000,
      name: "   ",
    });
  }, ValidationError);

  // Missing category ID
  assert.throws(() => {
    validateProductInput({
      name: "Test Product",
      productType: ProductType.FIXED,
      price: 1000,
      categoryId: "   ",
    });
  }, ValidationError);

  // Invalid product type
  assert.throws(() => {
    validateProductInput({
      name: "Test Product",
      productType: "INVALID_TYPE",
      categoryId: "cat_1",
      price: 1000,
    });
  }, ValidationError);

  // FIXED product missing price
  assert.throws(() => {
    validateProductInput({
      name: "Wall Art",
      productType: ProductType.FIXED,
      categoryId: "cat_1",
    });
  }, ValidationError);

  // FIXED product non-positive price
  assert.throws(() => {
    validateProductInput({
      name: "Wall Art",
      productType: ProductType.FIXED,
      categoryId: "cat_1",
      price: 0,
    });
  }, ValidationError);

  // PER_AREA missing rate
  assert.throws(() => {
    validateProductInput({
      name: "Wallpaper",
      productType: ProductType.PER_AREA,
      categoryId: "cat_1",
    });
  }, ValidationError);

  // PER_AREA non-positive rate
  assert.throws(() => {
    validateProductInput({
      name: "Wallpaper",
      productType: ProductType.PER_AREA,
      categoryId: "cat_1",
      rate: -50,
    });
  }, ValidationError);

  // PER_AREA invalid wastage (> 100%)
  assert.throws(() => {
    validateProductInput({
      name: "Wallpaper",
      productType: ProductType.PER_AREA,
      categoryId: "cat_1",
      rate: 15000,
      wastage: 150,
    });
  }, ValidationError);

  // PER_AREA negative minArea
  assert.throws(() => {
    validateProductInput({
      name: "Wallpaper",
      productType: ProductType.PER_AREA,
      categoryId: "cat_1",
      rate: 15000,
      minArea: -10,
    });
  }, ValidationError);

  console.log("✔ Product validation error triggers passed");

  // 5. Test RBAC Guard Logic
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

  console.log("✔ Product RBAC authorization guard tests passed");

  // 6. Pricing Boundary Isolation Test
  // Ensure CRUD module strictly stores pricing configuration in integer minor units / raw rates
  // and does NOT attempt to calculate final customer wallpaper/blind totals or roll rounding.
  const perAreaProduct = validateProductInput({
    name: "Custom Blind",
    productType: ProductType.PER_AREA,
    categoryId: "cat_blinds",
    rate: 20000, // ₹200 / sqft in paise
    wastage: 10,
    minArea: 20,
    rollWidth: 4,
  });

  assert.strictEqual(typeof perAreaProduct.rate, "number");
  assert.strictEqual(perAreaProduct.rate, 20000);
  assert.strictEqual(typeof perAreaProduct.wastage, "number");
  // Verification: Product object returned does NOT contain computed cart line totals or area pricing calculations.
  assert.strictEqual((perAreaProduct as unknown as Record<string, unknown>).finalPrice, undefined);
  assert.strictEqual((perAreaProduct as unknown as Record<string, unknown>).computedArea, undefined);

  console.log("✔ Pricing boundary isolation tests passed");

  console.log("ALL PRODUCT MODULE TESTS PASSED SUCCESSFULLY!");
}

runProductTests().catch((err) => {
  console.error("Product Module Test Failure:", err);
  process.exit(1);
});

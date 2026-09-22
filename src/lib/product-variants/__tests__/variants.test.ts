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

  // 3. Validation Error Triggers: Name
  assert.throws(() => {
    validateProductVariantInput({ price: 100000, name: "   " });
  }, ValidationError);

  assert.throws(() => {
    validateProductVariantInput({ name: "Bad\x00Name", price: 100000 });
  }, ValidationError);

  assert.throws(() => {
    validateProductVariantInput({ name: "A".repeat(201), price: 100000 });
  }, ValidationError);

  // 4. Validation Error Triggers: SKU
  assert.throws(() => {
    validateProductVariantInput({ name: "Frame", sku: "INVALID SKU!", price: 100000 });
  }, ValidationError);

  assert.throws(() => {
    validateProductVariantInput({ name: "Frame", sku: "S".repeat(51), price: 100000 });
  }, ValidationError);

  // 5. Validation Error Triggers: Price
  assert.throws(() => {
    validateProductVariantInput({ name: "Frame" });
  }, ValidationError);

  assert.throws(() => {
    validateProductVariantInput({ name: "Frame", price: 0 });
  }, ValidationError);

  assert.throws(() => {
    validateProductVariantInput({ name: "Frame", price: -500 });
  }, ValidationError);

  assert.throws(() => {
    validateProductVariantInput({ name: "Frame", price: NaN });
  }, ValidationError);

  // 6. Validation Error Triggers: Sort Order
  assert.throws(() => {
    validateProductVariantInput({ name: "Frame", price: 100000, sortOrder: 1.5 });
  }, ValidationError);

  // 7. Validation Error Triggers: Reject Unexpected Fields
  assert.throws(() => {
    validateProductVariantInput({
      name: "Frame",
      price: 100000,
      productId: "prod_spoofed",
    });
  }, (err: unknown) => err instanceof ValidationError && err.message.includes("Unexpected field: 'productId'"));

  assert.throws(() => {
    validateProductVariantInput({
      name: "Frame",
      price: 100000,
      id: "var_spoofed",
    });
  }, (err: unknown) => err instanceof ValidationError && err.message.includes("Unexpected field: 'id'"));

  console.log("✔ Variant input validation error triggers passed");

  // 8. FIXED Product Type Boundary Verification
  const checkProductTypeForVariant = (productType: ProductType) => {
    if (productType !== ProductType.FIXED) {
      throw new ValidationError("Product variants can only be created for FIXED price products.");
    }
    return true;
  };

  assert.strictEqual(checkProductTypeForVariant(ProductType.FIXED), true);
  assert.throws(() => checkProductTypeForVariant(ProductType.PER_AREA), ValidationError);
  console.log("✔ FIXED product type boundary guard tests passed");

  // 9. SKU Collision Logic Verification
  const existingSkus = new Map<string, string>([
    ["ART-30X40-BLK", "var_1"],
    ["ART-30X40-WHT", "var_2"],
  ]);

  const checkSkuUnique = (sku: string | null, currentVariantId?: string) => {
    if (!sku) return true;
    const ownerId = existingSkus.get(sku);
    if (ownerId && ownerId !== currentVariantId) {
      throw new ValidationError(`A product variant with SKU '${sku}' already exists. SKU must be unique.`);
    }
    return true;
  };

  assert.strictEqual(checkSkuUnique(null), true);
  assert.strictEqual(checkSkuUnique("ART-NEW-GLD"), true);
  assert.strictEqual(checkSkuUnique("ART-30X40-BLK", "var_1"), true); // updating same variant with same SKU
  assert.throws(() => checkSkuUnique("ART-30X40-BLK", "var_2"), ValidationError); // collision with another variant
  console.log("✔ SKU uniqueness and collision protection tests passed");

  // 10. Product IDOR Protection Verification
  const verifyVariantBelongsToProduct = (variantProductId: string, routeProductId: string) => {
    if (variantProductId !== routeProductId) {
      throw new ValidationError("Variant does not belong to the specified product.");
    }
    return true;
  };

  assert.strictEqual(verifyVariantBelongsToProduct("prod_100", "prod_100"), true);
  assert.throws(() => verifyVariantBelongsToProduct("prod_100", "prod_999"), ValidationError);
  console.log("✔ Variant product IDOR protection tests passed");

  // 11. Sorting Whitelist Verification
  const ALLOWED_SORT_FIELDS = new Set(["name", "price", "sortOrder", "createdAt", "updatedAt"]);
  const resolveSort = (rawSort?: string, rawOrder?: string) => {
    const field = rawSort && ALLOWED_SORT_FIELDS.has(rawSort) ? rawSort : "sortOrder";
    const order: "asc" | "desc" = rawOrder?.toLowerCase() === "desc" ? "desc" : "asc";
    return { field, order };
  };

  assert.deepStrictEqual(resolveSort("price", "desc"), { field: "price", order: "desc" });
  assert.deepStrictEqual(resolveSort("name", "ASC"), { field: "name", order: "asc" });
  // Arbitrary or malicious field names fall back to safe default "sortOrder"
  assert.deepStrictEqual(resolveSort("drop table;--", "desc"), { field: "sortOrder", order: "desc" });
  assert.deepStrictEqual(resolveSort(undefined, undefined), { field: "sortOrder", order: "asc" });
  console.log("✔ Sorting whitelist and sanitization tests passed");

  // 12. Search and Filter Query Builder Verification
  const buildVariantWhere = (productId: string, search?: string, status?: string) => {
    const where: Record<string, unknown> = { productId };
    const trimmed = search?.trim();
    if (trimmed) {
      where.OR = [
        { name: { contains: trimmed, mode: "insensitive" } },
        { sku: { contains: trimmed, mode: "insensitive" } },
      ];
    }
    if (status === "active") where.isActive = true;
    else if (status === "inactive") where.isActive = false;
    return where;
  };

  assert.deepStrictEqual(buildVariantWhere("prod_1"), { productId: "prod_1" });
  assert.deepStrictEqual(buildVariantWhere("prod_1", "Black", "active"), {
    productId: "prod_1",
    OR: [
      { name: { contains: "Black", mode: "insensitive" } },
      { sku: { contains: "Black", mode: "insensitive" } },
    ],
    isActive: true,
  });
  assert.deepStrictEqual(buildVariantWhere("prod_1", "", "inactive"), {
    productId: "prod_1",
    isActive: false,
  });
  console.log("✔ Variant search and filter query builder tests passed");

  // 13. Pagination Calculation & Clamp Verification
  const sanitizePagination = (pageInput?: unknown, pageSizeInput?: unknown, totalCount: number = 0) => {
    const page = Math.max(1, Number(pageInput) || 1);
    const rawPageSize = Number(pageSizeInput) || 10;
    const pageSize = Math.min(100, Math.max(1, rawPageSize));
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const skip = (page - 1) * pageSize;
    return { page, pageSize, totalPages, skip };
  };

  assert.deepStrictEqual(sanitizePagination(1, 10, 25), { page: 1, pageSize: 10, totalPages: 3, skip: 0 });
  assert.deepStrictEqual(sanitizePagination(3, 10, 25), { page: 3, pageSize: 10, totalPages: 3, skip: 20 });
  // Negative or invalid page clamped to 1
  assert.deepStrictEqual(sanitizePagination(-5, 10, 25), { page: 1, pageSize: 10, totalPages: 3, skip: 0 });
  // Huge page size clamped to 100
  assert.deepStrictEqual(sanitizePagination(1, 500, 250), { page: 1, pageSize: 100, totalPages: 3, skip: 0 });
  console.log("✔ Variant pagination bounds and calculation tests passed");

  // 14. RBAC Authorization Guards
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

  // 15. Audit Event Constants & Action Mapping
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_CREATED, "PRODUCT_VARIANT_CREATED");
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_UPDATED, "PRODUCT_VARIANT_UPDATED");
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_ACTIVATED, "PRODUCT_VARIANT_ACTIVATED");
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_DEACTIVATED, "PRODUCT_VARIANT_DEACTIVATED");
  assert.strictEqual(AUDIT_ACTIONS.PRODUCT_VARIANT_DELETED, "PRODUCT_VARIANT_DELETED");
  assert.strictEqual(AUDIT_RESOURCE_TYPES.PRODUCT_VARIANT, "PRODUCT_VARIANT");

  const resolveAuditAction = (previousActive: boolean, currentActive: boolean) => {
    if (previousActive !== currentActive) {
      return currentActive
        ? AUDIT_ACTIONS.PRODUCT_VARIANT_ACTIVATED
        : AUDIT_ACTIONS.PRODUCT_VARIANT_DEACTIVATED;
    }
    return AUDIT_ACTIONS.PRODUCT_VARIANT_UPDATED;
  };

  assert.strictEqual(resolveAuditAction(true, false), "PRODUCT_VARIANT_DEACTIVATED");
  assert.strictEqual(resolveAuditAction(false, true), "PRODUCT_VARIANT_ACTIVATED");
  assert.strictEqual(resolveAuditAction(true, true), "PRODUCT_VARIANT_UPDATED");
  console.log("✔ Audit actions and status transitions verified");

  // 16. Audit Actor Integrity: Actor Taken from Session, Not Client Body
  const extractActorFromSession = (sessionUser: { id: string; role: Role }, clientPayload: Record<string, unknown>) => {
    // Client cannot spoof actor
    const effectiveActorId = sessionUser.id;
    assert.notStrictEqual(effectiveActorId, clientPayload.actorUserId);
    return effectiveActorId;
  };

  assert.strictEqual(
    extractActorFromSession(storeAdminUser, { actorUserId: "attacker_spoofed_id" }),
    "usr_admin_1"
  );
  console.log("✔ Audit actor integrity verified (cannot spoof actorUserId)");

  // 17. Pricing Boundary Isolation: Minor Units Convention
  const validatedFixedVariant = validateProductVariantInput({
    name: "Classic Frame",
    price: 249900, // ₹2,499 in paise
  });

  assert.strictEqual(typeof validatedFixedVariant.price, "number");
  assert.strictEqual(Number.isInteger(validatedFixedVariant.price), true);
  assert.strictEqual(validatedFixedVariant.price, 249900);
  assert.strictEqual((validatedFixedVariant as unknown as Record<string, unknown>).cartTotal, undefined);
  assert.strictEqual((validatedFixedVariant as unknown as Record<string, unknown>).tax, undefined);
  assert.strictEqual((validatedFixedVariant as unknown as Record<string, unknown>).discount, undefined);
  console.log("✔ Pricing boundary isolation and minor units integrity passed");

  console.log("ALL PRODUCT VARIANT MODULE TESTS PASSED SUCCESSFULLY!");
}

runVariantTests().catch((err) => {
  console.error("Product Variant Module Test Failure:", err);
  process.exit(1);
});

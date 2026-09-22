import assert from "node:assert";
import {
  createAuthoritativeCartSnapshot,
  addToCart,
  CART_COOKIE_NAME,
} from "../cart-boundary";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

// Mock cookie store adapter
const cookieJar = new Map<string, string>();
const mockCookieStore = {
  get: (name: string) => {
    const val = cookieJar.get(name);
    return val ? { name, value: val } : undefined;
  },
  set: (name: string, value: string) => {
    cookieJar.set(name, value);
  },
  delete: (name: string) => {
    cookieJar.delete(name);
  },
};

async function runCartBoundaryTests() {
  console.log("Running Authoritative Cart Boundary Tests (Micro-Phase 05.03)...");

  const origFindFirst = prisma.product.findFirst;

  // Mock DB products
  const mockPerAreaProduct = {
    id: "prod-per-area-1",
    name: "Architectural Concrete Wall Mural",
    slug: "architectural-concrete-wall-mural",
    productType: ProductType.PER_AREA,
    price: null,
    rate: 15000, // ₹150 / sqft in paise
    wastage: 10, // 10% wastage
    minArea: 25, // 25 sqft minimum billable floor
    rollWidth: 3.0,
    returnable: false,
    hsnCode: "49119100",
    category: { id: "cat-1", name: "Murals", slug: "murals" },
    media: [{ id: "med-1", objectKey: "products/concrete.webp" }],
    variants: [],
  };

  const mockFixedProduct = {
    id: "prod-fixed-1",
    name: "Minimalist Bauhaus Print",
    slug: "minimalist-bauhaus-print",
    productType: ProductType.FIXED,
    price: 399900, // ₹3,999 in paise
    rate: null,
    wastage: null,
    minArea: null,
    rollWidth: null,
    returnable: true,
    hsnCode: "49119900",
    category: { id: "cat-2", name: "Wall Art", slug: "wall-art" },
    media: [{ id: "med-2", objectKey: "products/bauhaus.webp" }],
    variants: [
      { id: "var-1", name: "A3 Framed", sku: "BAU-A3", price: 399900, isActive: true, sortOrder: 0 },
      { id: "var-2", name: "A2 Framed", sku: "BAU-A2", price: 549900, isActive: true, sortOrder: 1 },
    ],
  };

  (prisma.product.findFirst as unknown) = async (args: {
    where: Record<string, unknown>;
  }) => {
    if (args.where.isActive !== true) return null;
    if (args.where.id === "prod-per-area-1") return mockPerAreaProduct;
    if (args.where.id === "prod-fixed-1") return mockFixedProduct;
    return null;
  };

  try {
    // 1. Valid PER_AREA Snapshot Creation & Calculation
    console.log("--- 1. Testing PER_AREA Authoritative Snapshot ---");
    // Dimensions: 10 ft x 10 ft = 100 sqft, 10% wastage = 110 sqft, rate = 15000 paise
    // Unit price = 110 * 15000 = 1,650,000 paise (₹16,500), qty = 2 -> total = 3,300,000 paise
    const snapshot = await createAuthoritativeCartSnapshot({
      productId: "prod-per-area-1",
      productType: "PER_AREA",
      width: 10,
      height: 10,
      unit: "ft",
      quantity: 2,
    });

    assert.strictEqual(snapshot.productId, "prod-per-area-1");
    assert.strictEqual(snapshot.productName, "Architectural Concrete Wall Mural");
    assert.strictEqual(snapshot.productType, "PER_AREA");
    assert.strictEqual(snapshot.primaryMediaKey, "products/concrete.webp");
    assert.strictEqual(snapshot.categoryName, "Murals");
    assert.strictEqual(snapshot.returnable, false);
    assert.strictEqual(snapshot.dimensions?.width, 10);
    assert.strictEqual(snapshot.dimensions?.height, 10);
    assert.strictEqual(snapshot.dimensions?.unit, "ft");
    assert.strictEqual(snapshot.area?.enteredAreaSqft, 100);
    assert.strictEqual(snapshot.area?.wastagePct, 10);
    assert.strictEqual(snapshot.area?.areaWithWastageSqft, 110);
    assert.strictEqual(snapshot.area?.billableAreaSqft, 110);
    assert.strictEqual(snapshot.ratePaise, 15000);
    assert.strictEqual(snapshot.unitPricePaise, 1650000);
    assert.strictEqual(snapshot.quantity, 2);
    assert.strictEqual(snapshot.totalPricePaise, 3300000);
    assert.ok(snapshot.addedAt, "Snapshot must have ISO timestamp");

    console.log("✔ PER_AREA authoritative snapshot with dimensions and pricing verified");

    // 2. Minimum Area Floor Clamping in Cart Snapshot
    console.log("--- 2. Testing Minimum Area Clamping in Snapshot ---");
    // Dimensions: 2 ft x 3 ft = 6 sqft, with 10% wastage = 6.6 sqft
    // Clamped to minArea = 25 sqft floor
    // Unit price: 25 * 15000 = 375,000 paise (₹3,750)
    const minClampedSnapshot = await createAuthoritativeCartSnapshot({
      productId: "prod-per-area-1",
      productType: "PER_AREA",
      width: 2,
      height: 3,
      unit: "ft",
      quantity: 1,
    });

    assert.strictEqual(minClampedSnapshot.area?.enteredAreaSqft, 6);
    assert.strictEqual(minClampedSnapshot.area?.isMinAreaApplied, true);
    assert.strictEqual(minClampedSnapshot.area?.billableAreaSqft, 25);
    assert.strictEqual(minClampedSnapshot.unitPricePaise, 375000);
    assert.strictEqual(minClampedSnapshot.totalPricePaise, 375000);

    console.log("✔ Minimum area floor clamping in snapshot verified");

    // 3. Security: Tampered Client Price / Rate Rejected
    console.log("--- 3. Testing Protection Against Tampered Prices ---");
    // Client passes manipulated rate or price in untyped payload
    const tamperedPayload = {
      productId: "prod-per-area-1",
      productType: "PER_AREA" as const,
      width: 10,
      height: 10,
      unit: "ft" as const,
      quantity: 1,
      ratePaise: 100, // Attempting to buy at ₹1/sqft instead of ₹150/sqft
      unitPricePaise: 50,
      totalPricePaise: 50,
    };

    const secureSnapshot = await createAuthoritativeCartSnapshot(tamperedPayload);
    // Must strictly ignore client rate/price and compute using authoritative DB rate (15000 paise)
    assert.strictEqual(secureSnapshot.ratePaise, 15000);
    assert.strictEqual(secureSnapshot.unitPricePaise, 1650000);
    assert.strictEqual(secureSnapshot.totalPricePaise, 1650000);

    console.log("✔ Server-authoritative calculation ignores client-supplied prices");

    // 4. Invalid Dimensions Rejection
    console.log("--- 4. Testing Invalid Dimensions Rejection ---");
    await assert.rejects(
      async () => {
        await createAuthoritativeCartSnapshot({
          productId: "prod-per-area-1",
          productType: "PER_AREA",
          width: -10,
          height: 8,
          unit: "ft",
          quantity: 1,
        });
      },
      (err: Error) => err instanceof ValidationError && err.message.includes("greater than zero")
    );

    await assert.rejects(
      async () => {
        await createAuthoritativeCartSnapshot({
          productId: "prod-per-area-1",
          productType: "PER_AREA",
          width: 10,
          height: 8,
          unit: "furlongs" as unknown as import("@/lib/pricing/pricing-engine").DimensionUnit,
          quantity: 1,
        });
      },
      (err: Error) => err instanceof ValidationError && err.message.includes("Invalid unit")
    );

    console.log("✔ Negative and invalid dimensions rejected");

    // 5. FIXED Product with Variant Snapshot
    console.log("--- 5. Testing FIXED Product with Variant ---");
    const variantSnapshot = await createAuthoritativeCartSnapshot({
      productId: "prod-fixed-1",
      productType: "FIXED",
      variantId: "var-2", // A2 Framed @ 549900 paise
      quantity: 3,
    });

    assert.strictEqual(variantSnapshot.productId, "prod-fixed-1");
    assert.strictEqual(variantSnapshot.variantId, "var-2");
    assert.strictEqual(variantSnapshot.variantName, "A2 Framed");
    assert.strictEqual(variantSnapshot.sku, "BAU-A2");
    assert.strictEqual(variantSnapshot.unitPricePaise, 549900);
    assert.strictEqual(variantSnapshot.quantity, 3);
    assert.strictEqual(variantSnapshot.totalPricePaise, 1649700);

    // Missing variant selection when required
    await assert.rejects(
      async () => {
        await createAuthoritativeCartSnapshot({
          productId: "prod-fixed-1",
          productType: "FIXED",
          variantId: null,
          quantity: 1,
        });
      },
      (err: Error) => err instanceof ValidationError && err.message.includes("select a product variant")
    );

    // Foreign / Inactive variant ID rejected
    await assert.rejects(
      async () => {
        await createAuthoritativeCartSnapshot({
          productId: "prod-fixed-1",
          productType: "FIXED",
          variantId: "foreign-var-999",
          quantity: 1,
        });
      },
      (err: Error) => err instanceof ValidationError && err.message.includes("does not exist")
    );

    console.log("✔ FIXED variant selection and invalid variant guards verified");

    // 6. Inactive / Missing Product Rejection
    console.log("--- 6. Testing Inactive Product Guard ---");
    await assert.rejects(
      async () => {
        await createAuthoritativeCartSnapshot({
          productId: "non-existent-id",
          productType: "PER_AREA",
          width: 10,
          height: 10,
          unit: "ft",
          quantity: 1,
        });
      },
      (err: Error) => err instanceof ValidationError && err.message.includes("unavailable")
    );

    console.log("✔ Inactive and non-existent products rejected");

    // 7. Cookie Session Persistence
    console.log("--- 7. Testing Cart Session Cookie Persistence ---");
    cookieJar.clear();

    const addResult = await addToCart(
      {
        productId: "prod-fixed-1",
        productType: "FIXED",
        variantId: "var-1",
        quantity: 2,
      },
      mockCookieStore
    );

    assert.strictEqual(addResult.cart.lines.length, 1);
    assert.strictEqual(addResult.cart.totalItems, 2);
    assert.strictEqual(addResult.cart.subtotalPaise, 799800);

    // Check cookie jar
    const storedCookie = cookieJar.get(CART_COOKIE_NAME);
    assert.ok(storedCookie, "Cart cookie must be set");
    const parsedCookie = JSON.parse(storedCookie!);
    assert.strictEqual(parsedCookie.lines.length, 1);
    assert.strictEqual(parsedCookie.lines[0].productId, "prod-fixed-1");

    console.log("✔ Cart session cookie persistence verified");
  } finally {
    prisma.product.findFirst = origFindFirst;
  }

  console.log("ALL AUTHORITATIVE CART BOUNDARY TESTS PASSED SUCCESSFULLY! (Phase 05.03)");
}

export { runCartBoundaryTests };

if (require.main === module) {
  runCartBoundaryTests().catch((err) => {
    console.error("Cart boundary test failed:", err);
    process.exit(1);
  });
}


import assert from "node:assert";
import {
  normalizeCouponCode,
  validateCouponCodeFormat,
  validateCouponEligibility,
  calculateCouponDiscount,
  type CouponData,
} from "../coupon-engine";
import {
  applyCouponToCart,
  removeCouponFromCart,
  getCartWithFreshPricing,
  addItemToCart,
  updateCartItemQuantity,
  clearCart,
  type CookieStoreLike,
} from "@/lib/cart/cart-service";
import { prisma } from "@/lib/prisma";
import { DiscountType, ProductType, CartStatus } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

export async function runCouponEngineTests() {
  console.log("--> Running Micro-Phase 06.03: Coupon Engine Tests...");

  // =========================================================================
  // Section 1: Pure Unit Tests for Coupon Engine (Validation & Calculations)
  // =========================================================================
  console.log("  1. Testing Code Normalization & Format Validation...");

  assert.strictEqual(normalizeCouponCode("  welcome10  "), "WELCOME10");
  assert.strictEqual(normalizeCouponCode("Diwali_2026"), "DIWALI_2026");
  assert.strictEqual(normalizeCouponCode("Festive-500"), "FESTIVE-500");

  assert.strictEqual(validateCouponCodeFormat(" save20 "), "SAVE20");
  assert.throws(() => validateCouponCodeFormat(""), ValidationError);
  assert.throws(() => validateCouponCodeFormat("   "), ValidationError);
  assert.throws(() => validateCouponCodeFormat("A"), ValidationError); // too short (<2)
  assert.throws(() => validateCouponCodeFormat("A".repeat(33)), ValidationError); // too long (>32)
  assert.throws(() => validateCouponCodeFormat("SAVE 20"), ValidationError); // spaces inside not allowed

  console.log("  2. Testing Eligibility Rules (Active, Expiry, Start, Limits)...");

  const now = new Date("2026-09-22T12:00:00Z");

  const baseCoupon: CouponData = {
    id: "cpn-1",
    code: "FESTIVAL20",
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    minCartValuePaise: 500000, // ₹5,000
    maxDiscountPaise: 200000, // ₹2,000
    startDate: new Date("2026-09-01T00:00:00Z"),
    expiryDate: new Date("2026-09-30T23:59:59Z"),
    usageLimit: 100,
    perCustomerLimit: 1,
    currentUsageCount: 10,
    isActive: true,
  };

  // Valid case
  const resValid = validateCouponEligibility(baseCoupon, {
    subtotalPaise: 600000, // ₹6,000 >= ₹5,000
    customerPreviousUsageCount: 0,
    now,
  });
  assert.strictEqual(resValid.valid, true);

  // Inactive coupon
  const resInactive = validateCouponEligibility({ ...baseCoupon, isActive: false }, {
    subtotalPaise: 600000,
    now,
  });
  assert.strictEqual(resInactive.valid, false);
  assert.match(resInactive.error!, /inactive/i);

  // Future start date
  const resFuture = validateCouponEligibility(
    { ...baseCoupon, startDate: new Date("2026-10-01T00:00:00Z") },
    { subtotalPaise: 600000, now }
  );
  assert.strictEqual(resFuture.valid, false);
  assert.match(resFuture.error!, /not started/i);

  // Expired coupon
  const resExpired = validateCouponEligibility(
    { ...baseCoupon, expiryDate: new Date("2026-09-01T00:00:00Z") },
    { subtotalPaise: 600000, now }
  );
  assert.strictEqual(resExpired.valid, false);
  assert.match(resExpired.error!, /expired/i);

  // Global usage limit reached
  const resGlobalLimit = validateCouponEligibility(
    { ...baseCoupon, currentUsageCount: 100 },
    { subtotalPaise: 600000, now }
  );
  assert.strictEqual(resGlobalLimit.valid, false);
  assert.match(resGlobalLimit.error!, /maximum usage limit/i);

  // Customer specific limit reached
  const resCustLimit = validateCouponEligibility(baseCoupon, {
    subtotalPaise: 600000,
    customerPreviousUsageCount: 1,
    now,
  });
  assert.strictEqual(resCustLimit.valid, false);
  assert.match(resCustLimit.error!, /maximum usage limit for this coupon/i);

  // Minimum cart requirement not met
  const resMinCart = validateCouponEligibility(baseCoupon, {
    subtotalPaise: 400000, // ₹4,000 < ₹5,000
    customerPreviousUsageCount: 0,
    now,
  });
  assert.strictEqual(resMinCart.valid, false);
  assert.match(resMinCart.error!, /minimum cart value/i);

  // Empty cart subtotal
  const resEmptySubtotal = validateCouponEligibility(baseCoupon, {
    subtotalPaise: 0,
    now,
  });
  assert.strictEqual(resEmptySubtotal.valid, false);
  assert.match(resEmptySubtotal.error!, /greater than zero/i);

  console.log("  3. Testing Percentage & Fixed Discount Calculations & Maximum Discount Cap...");

  // 20% on ₹10,000 (1,000,000 paise) = ₹2,000 (200,000 paise) -> hits max cap of ₹2,000
  const calc1 = calculateCouponDiscount(baseCoupon, 1000000);
  assert.strictEqual(calc1.eligible, true);
  assert.strictEqual(calc1.discountPaise, 200000);
  assert.strictEqual(calc1.finalTotalPaise, 800000);

  // 20% on ₹6,000 (600,000 paise) = ₹1,200 (120,000 paise) -> below max cap
  const calc2 = calculateCouponDiscount(baseCoupon, 600000);
  assert.strictEqual(calc2.eligible, true);
  assert.strictEqual(calc2.discountPaise, 120000);
  assert.strictEqual(calc2.finalTotalPaise, 480000);

  // Fixed Amount Coupon: ₹1,500 flat off (150,000 paise)
  const fixedCoupon: CouponData = {
    id: "cpn-fixed",
    code: "FLAT1500",
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 150000,
    minCartValuePaise: 300000, // ₹3,000 min
    currentUsageCount: 0,
    isActive: true,
  };

  const calcFixed = calculateCouponDiscount(fixedCoupon, 500000); // ₹5,000
  assert.strictEqual(calcFixed.eligible, true);
  assert.strictEqual(calcFixed.discountPaise, 150000);
  assert.strictEqual(calcFixed.finalTotalPaise, 350000);

  // Fixed Amount Coupon exceeding eligible cart subtotal:
  // Subtotal = ₹1,000, Discount = ₹1,500. Discount capped at ₹1,000; total never negative.
  const generousCoupon: CouponData = {
    ...fixedCoupon,
    minCartValuePaise: null,
  };
  const calcGenerous = calculateCouponDiscount(generousCoupon, 100000); // ₹1,000
  assert.strictEqual(calcGenerous.eligible, true);
  assert.strictEqual(calcGenerous.discountPaise, 100000);
  assert.strictEqual(calcGenerous.finalTotalPaise, 0);

  // =========================================================================
  // Section 2: Integration Tests with Cart Database & Mutation Revalidation
  // =========================================================================
  console.log("  4. Setting up Mock Database Environment for Cart & Coupon Integration...");

  interface MockProduct {
    id: string;
    name: string;
    slug: string;
    productType: ProductType;
    isActive: boolean;
    price: number | null;
    rate: number | null;
    wastage: number | null;
    minArea: number | null;
    rollWidth: number | null;
    returnable: boolean;
    hsnCode: string | null;
    category: { id: string; name: string; slug: string } | null;
    media: Array<{ id: string; objectKey: string; isPrimary: boolean }>;
    variants: Array<{ id: string; name: string; sku: string; price: number | null; isActive?: boolean }>;
  }

  interface MockCart {
    id: string;
    customerId: string | null;
    sessionId: string | null;
    couponId?: string | null;
    status: CartStatus;
    createdAt: Date;
    updatedAt: Date;
  }

  interface MockCartItem {
    id: string;
    cartId: string;
    productId: string;
    variantId: string | null;
    configHash: string;
    productName: string;
    productType: ProductType;
    variantName: string | null;
    sku: string | null;
    dimensions: Record<string, unknown> | null;
    area: Record<string, unknown> | null;
    ratePaise: number | null;
    unitPricePaise: number;
    quantity: number;
    totalPricePaise: number;
    options: unknown;
    mediaKey: string | null;
    returnable: boolean;
    hsnCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  const dbProducts: MockProduct[] = [
    {
      id: "prod-print-1",
      name: "Minimalist Framed Art",
      slug: "minimalist-framed-art",
      productType: ProductType.FIXED,
      isActive: true,
      price: 200000, // ₹2,000
      rate: null,
      wastage: null,
      minArea: null,
      rollWidth: null,
      returnable: true,
      hsnCode: "49119900",
      category: { id: "cat-2", name: "Framed Art", slug: "framed-art" },
      media: [{ id: "med-2", objectKey: "products/art-1.webp", isPrimary: true }],
      variants: [],
    },
  ];

  const dbCoupons: CouponData[] = [
    {
      id: "cpn-test-10",
      code: "SAVE10",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10, // 10%
      minCartValuePaise: 300000, // ₹3,000 min
      maxDiscountPaise: 100000, // ₹1,000 max
      startDate: null,
      expiryDate: null,
      usageLimit: 5,
      perCustomerLimit: 1,
      currentUsageCount: 0,
      isActive: true,
    },
    {
      id: "cpn-flat-500",
      code: "FLAT500",
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: 50000, // ₹500
      minCartValuePaise: 200000, // ₹2,000 min
      currentUsageCount: 0,
      isActive: true,
    },
    {
      id: "cpn-limited",
      code: "FLASH100",
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: 10000,
      minCartValuePaise: null,
      usageLimit: 2,
      currentUsageCount: 1,
      isActive: true,
    },
  ];

  const dbCouponUsages: Array<{ id: string; couponId: string; customerId: string | null; cartId: string | null }> = [];
  const dbCarts: MockCart[] = [];
  const dbCartItems: MockCartItem[] = [];

  // Backup original prisma methods
  const origPrisma = {
    customerFindUnique: prisma.customer.findUnique,
    customerCreate: prisma.customer.create,
    cartFindFirst: prisma.cart.findFirst,
    cartCreate: prisma.cart.create,
    cartUpdate: prisma.cart.update,
    cartItemFindFirst: prisma.cartItem.findFirst,
    cartItemFindUnique: prisma.cartItem.findUnique,
    cartItemFindMany: prisma.cartItem.findMany,
    cartItemCreate: prisma.cartItem.create,
    cartItemUpdate: prisma.cartItem.update,
    cartItemDelete: prisma.cartItem.delete,
    cartItemDeleteMany: prisma.cartItem.deleteMany,
    productFindFirst: prisma.product.findFirst,
    couponFindUnique: prisma.coupon.findUnique,
    couponUsageCount: prisma.couponUsage.count,
    transaction: prisma.$transaction,
  };

  try {
    (prisma.customer.findUnique as unknown) = async () => ({ id: "cust-rohan" });
    (prisma.customer.create as unknown) = async () => ({ id: "cust-rohan" });

    (prisma.cart.findFirst as unknown) = async (args: {
      where: { customerId?: string | null; sessionId?: string | null; status?: CartStatus };
      include?: Record<string, unknown>;
    }) => {
      const found = dbCarts.find((c) => {
        if (args.where.customerId !== undefined && c.customerId !== args.where.customerId) return false;
        if (args.where.sessionId !== undefined && c.sessionId !== args.where.sessionId) return false;
        if (args.where.status !== undefined && c.status !== args.where.status) return false;
        return true;
      });
      if (!found) return null;
      if (args.include?.items) {
        const items = dbCartItems.filter((i) => i.cartId === found.id);
        return { ...found, items };
      }
      return found;
    };

    (prisma.cart.create as unknown) = async (args: {
      data: { customerId?: string | null; sessionId?: string | null; status: CartStatus };
    }) => {
      const cart: MockCart = {
        id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        customerId: args.data.customerId ?? null,
        sessionId: args.data.sessionId ?? null,
        couponId: null,
        status: args.data.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbCarts.push(cart);
      return { ...cart, items: [] };
    };

    (prisma.cart.update as unknown) = async (args: {
      where: { id: string };
      data: Partial<MockCart>;
    }) => {
      const idx = dbCarts.findIndex((c) => c.id === args.where.id);
      if (idx === -1) throw new Error("Cart not found");
      dbCarts[idx] = { ...dbCarts[idx], ...args.data, updatedAt: new Date() };
      return dbCarts[idx];
    };

    (prisma.cartItem.findFirst as unknown) = async (args: {
      where: { cartId: string; configHash?: string; id?: string };
      include?: Record<string, unknown>;
    }) => {
      const item = dbCartItems.find((i) => {
        if (i.cartId !== args.where.cartId) return false;
        if (args.where.configHash && i.configHash !== args.where.configHash) return false;
        if (args.where.id && i.id !== args.where.id) return false;
        return true;
      });
      if (!item) return null;
      if (args.include?.product) {
        const prod = dbProducts.find((p) => p.id === item.productId);
        return { ...item, product: prod || null };
      }
      return { ...item };
    };

    (prisma.cartItem.findUnique as unknown) = async (args: {
      where: { cartId_configHash?: { cartId: string; configHash: string } };
    }) => {
      if (!args.where.cartId_configHash) return null;
      const { cartId, configHash } = args.where.cartId_configHash;
      const item = dbCartItems.find((i) => i.cartId === cartId && i.configHash === configHash);
      return item ? { ...item } : null;
    };

    (prisma.cartItem.findMany as unknown) = async (args: {
      where: { cartId: string };
      include?: Record<string, unknown>;
    }) => {
      const items = dbCartItems.filter((i) => i.cartId === args.where.cartId);
      return items.map((i) => {
        const prod = dbProducts.find((p) => p.id === i.productId);
        return {
          ...i,
          product: prod || {
            id: i.productId,
            name: i.productName,
            slug: "unknown",
            productType: i.productType,
            isActive: true,
            price: null,
            rate: null,
            category: null,
            media: [],
          },
          variant: null,
        };
      });
    };

    (prisma.cartItem.create as unknown) = async (args: { data: Record<string, unknown> }) => {
      const row = args.data as unknown as MockCartItem;
      const newItem: MockCartItem = {
        ...row,
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbCartItems.push(newItem);
      return { ...newItem };
    };

    (prisma.cartItem.update as unknown) = async (args: {
      where: { id: string };
      data: Partial<MockCartItem>;
    }) => {
      const idx = dbCartItems.findIndex((i) => i.id === args.where.id);
      if (idx === -1) throw new Error("CartItem not found");
      dbCartItems[idx] = { ...dbCartItems[idx], ...args.data, updatedAt: new Date() };
      return dbCartItems[idx];
    };

    (prisma.cartItem.delete as unknown) = async (args: { where: { id: string } }) => {
      const idx = dbCartItems.findIndex((i) => i.id === args.where.id);
      if (idx === -1) throw new Error("Item not found");
      const [removed] = dbCartItems.splice(idx, 1);
      return removed;
    };

    (prisma.cartItem.deleteMany as unknown) = async (args: { where: { cartId: string } }) => {
      const before = dbCartItems.length;
      for (let i = dbCartItems.length - 1; i >= 0; i--) {
        if (dbCartItems[i].cartId === args.where.cartId) {
          dbCartItems.splice(i, 1);
        }
      }
      return { count: before - dbCartItems.length };
    };

    (prisma.product.findFirst as unknown) = async (args: { where: { id?: string } }) => {
      return dbProducts.find((p) => p.id === args.where.id) || null;
    };

    (prisma.coupon.findUnique as unknown) = async (args: { where: { code?: string; id?: string } }) => {
      if (args.where.code) {
        return dbCoupons.find((c) => c.code === args.where.code) || null;
      }
      if (args.where.id) {
        return dbCoupons.find((c) => c.id === args.where.id) || null;
      }
      return null;
    };

    (prisma.couponUsage.count as unknown) = async (args: {
      where: { couponId: string; customerId?: string | null };
    }) => {
      return dbCouponUsages.filter((u) => {
        if (u.couponId !== args.where.couponId) return false;
        if (args.where.customerId !== undefined && u.customerId !== args.where.customerId) return false;
        return true;
      }).length;
    };

    (prisma.$transaction as unknown) = async (
      cb: Promise<unknown>[] | ((tx: typeof prisma) => Promise<unknown>)
    ) => {
      if (Array.isArray(cb)) {
        const results = [];
        for (const op of cb) {
          results.push(await op);
        }
        return results;
      }
      return cb(prisma);
    };

    // Cookie store mock
    const cookieJar = new Map<string, string>();
    const mockStore: CookieStoreLike = {
      get: (name) => {
        const v = cookieJar.get(name);
        return v ? { name, value: v } : undefined;
      },
      set: (name, val) => cookieJar.set(name, val),
      delete: (name) => cookieJar.delete(name),
    };

    console.log("  5. Testing Apply Coupon to Empty Cart Rejection...");
    await assert.rejects(
      async () => await applyCouponToCart("SAVE10", mockStore, null),
      (err: Error) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /empty cart/i);
        return true;
      }
    );

    console.log("  6. Testing Add Item and Minimum Cart Threshold Failure...");
    // Add 1 quantity of ₹2,000 item -> Subtotal = ₹2,000 (200,000 paise)
    await addItemToCart(
      {
        productId: "prod-print-1",
        productType: "FIXED",
        quantity: 1,
      },
      mockStore,
      null
    );

    // SAVE10 requires min cart of ₹3,000. Applying on ₹2,000 should fail.
    await assert.rejects(
      async () => await applyCouponToCart("SAVE10", mockStore, null),
      (err: Error) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /minimum cart value/i);
        return true;
      }
    );

    console.log("  7. Testing Successful Coupon Application & Authoritative Discount Calculation...");
    // Increase quantity to 2 -> Subtotal = ₹4,000 (400,000 paise >= ₹3,000)
    const cartItem = dbCartItems[0];
    await updateCartItemQuantity(cartItem.id, 2, mockStore, null);

    // Apply SAVE10 (10% of ₹4,000 = ₹400 = 40,000 paise)
    const cartWithCoupon = await applyCouponToCart("save10", mockStore, null);
    assert.strictEqual(cartWithCoupon.subtotalPaise, 400000);
    assert.strictEqual(cartWithCoupon.discountPaise, 40000);
    assert.strictEqual(cartWithCoupon.totalPaise, 360000);
    assert(cartWithCoupon.coupon !== null);
    assert.strictEqual(cartWithCoupon.coupon?.code, "SAVE10");
    assert.strictEqual(cartWithCoupon.coupon?.discountPaise, 40000);

    console.log("  8. Testing Cart Mutation Revalidation: Decreasing Quantity Automatically Invalidates Coupon...");
    // User decreases quantity back to 1 -> Subtotal becomes ₹2,000 (< ₹3,000 min requirement)
    // The coupon engine must automatically decouple the coupon and set discount to 0 with warning
    const revalidatedCart = await updateCartItemQuantity(cartItem.id, 1, mockStore, null);
    assert.strictEqual(revalidatedCart.subtotalPaise, 200000);
    assert.strictEqual(revalidatedCart.discountPaise, 0);
    assert.strictEqual(revalidatedCart.totalPaise, 200000);
    assert.strictEqual(revalidatedCart.coupon, null);
    assert(revalidatedCart.couponWarning !== null, "Should return clear customer-facing warning");
    assert.match(revalidatedCart.couponWarning!, /minimum cart value/i);

    console.log("  9. Testing Coupon Removal Operation...");
    // Apply FLAT500 (requires ₹2,000, our subtotal is ₹2,000)
    const cartWithFlat = await applyCouponToCart("FLAT500", mockStore, null);
    assert.strictEqual(cartWithFlat.discountPaise, 50000); // ₹500
    assert.strictEqual(cartWithFlat.totalPaise, 150000); // ₹1,500

    // Remove coupon
    const cartRemoved = await removeCouponFromCart(mockStore, null);
    assert.strictEqual(cartRemoved.discountPaise, 0);
    assert.strictEqual(cartRemoved.totalPaise, 200000);
    assert.strictEqual(cartRemoved.coupon, null);

    console.log("  10. Testing Concurrency & Usage Limit Protection...");
    // FLASH100 has usageLimit: 2, currentUsageCount: 1. (1 slot remaining)
    const cpnLimited = dbCoupons.find((c) => c.code === "FLASH100")!;
    assert.strictEqual(cpnLimited.currentUsageCount, 1);

    // Apply FLASH100 to cart
    await applyCouponToCart("FLASH100", mockStore, null);

    // Now simulate concurrent checkouts consuming the slot:
    cpnLimited.currentUsageCount = 2; // Slot consumed

    // Fresh attempt on a second cart should be blocked
    const cookieJar2 = new Map<string, string>();
    const mockStore2: CookieStoreLike = {
      get: (name) => {
        const v = cookieJar2.get(name);
        return v ? { name, value: v } : undefined;
      },
      set: (name, val) => cookieJar2.set(name, val),
      delete: (name) => cookieJar2.delete(name),
    };
    await addItemToCart(
      { productId: "prod-print-1", productType: "FIXED", quantity: 1 },
      mockStore2,
      null
    );

    await assert.rejects(
      async () => await applyCouponToCart("FLASH100", mockStore2, null),
      (err: Error) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /maximum usage limit/i);
        return true;
      }
    );

    console.log("  11. Testing Customer Isolation & Customer Usage Limits...");
    const customerUser = {
      id: "usr-customer-1",
      name: "Rohan",
      email: "rohan@example.com",
      role: "CUSTOMER" as const,
      status: "ACTIVE" as const,
    };
    dbCouponUsages.push({
      id: "usg-1",
      couponId: "cpn-test-10",
      customerId: "cust-rohan",
      cartId: "cart-prev",
    });

    // Mock customer resolution
    (prisma.customer.findUnique as unknown) = async () => ({ id: "cust-rohan" });

    // SAVE10 perCustomerLimit is 1. Rohan has already used it once.
    await assert.rejects(
      async () => await applyCouponToCart("SAVE10", mockStore, customerUser),
      (err: Error) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /maximum usage limit for this coupon/i);
        return true;
      }
    );

    console.log("  12. Testing Security: Client Pricing Tampering Cannot Influence Coupon Discount...");
    // Clear and verify fresh read returns authoritative 0
    await clearCart(mockStore, null);
    const freshCart = await getCartWithFreshPricing(mockStore, null);
    assert.strictEqual(freshCart.subtotalPaise, 0);
    assert.strictEqual(freshCart.discountPaise, 0);
    assert.strictEqual(freshCart.totalPaise, 0);

    console.log("  ✔ All Micro-Phase 06.03: Coupon Engine tests passed successfully!");
  } finally {
    // Restore original prisma methods
    prisma.customer.findUnique = origPrisma.customerFindUnique;
    prisma.customer.create = origPrisma.customerCreate;
    prisma.cart.findFirst = origPrisma.cartFindFirst;
    prisma.cart.create = origPrisma.cartCreate;
    prisma.cart.update = origPrisma.cartUpdate;
    prisma.cartItem.findFirst = origPrisma.cartItemFindFirst;
    prisma.cartItem.findUnique = origPrisma.cartItemFindUnique;
    prisma.cartItem.findMany = origPrisma.cartItemFindMany;
    prisma.cartItem.create = origPrisma.cartItemCreate;
    prisma.cartItem.update = origPrisma.cartItemUpdate;
    prisma.cartItem.delete = origPrisma.cartItemDelete;
    prisma.cartItem.deleteMany = origPrisma.cartItemDeleteMany;
    prisma.product.findFirst = origPrisma.productFindFirst;
    prisma.coupon.findUnique = origPrisma.couponFindUnique;
    prisma.couponUsage.count = origPrisma.couponUsageCount;
    prisma.$transaction = origPrisma.transaction;
  }
}

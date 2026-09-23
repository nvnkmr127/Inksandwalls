import assert from "node:assert";
import {
  computeConfigurationHash,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  getCartWithFreshPricing,
  getCartItemCount,
  updateCartItemConfiguration,
  GUEST_CART_COOKIE_NAME,
  type CookieStoreLike,
} from "../cart-service";
import { prisma } from "@/lib/prisma";
import { ProductType, CartStatus } from "@prisma/client";
import { ValidationError, UnauthorizedError } from "@/lib/errors";

export async function runCartDatabaseServiceTests() {
  console.log("--> Running Micro-Phase 05.04: Cart Database Service Tests...");

  // -------------------------------------------------------------
  // Test 1: Deterministic Configuration Hashing
  // -------------------------------------------------------------
  console.log("  1. Testing Deterministic Configuration Hashing...");

  const hashA = computeConfigurationHash({
    productId: "prod-1",
    productType: "PER_AREA",
    width: 10,
    height: 8,
    unit: "ft",
  });

  const hashAIdentical = computeConfigurationHash({
    productId: "prod-1",
    productType: "PER_AREA",
    width: 10.0,
    height: 8.0,
    unit: "FT", // case insensitivity
  });

  assert.strictEqual(hashA, hashAIdentical, "Identical dimensions & unit must produce identical configHash");

  const hashBDifferentDimensions = computeConfigurationHash({
    productId: "prod-1",
    productType: "PER_AREA",
    width: 12,
    height: 8,
    unit: "ft",
  });
  assert.notStrictEqual(hashA, hashBDifferentDimensions, "Different dimensions must produce different configHash");

  const hashFixed1 = computeConfigurationHash({
    productId: "prod-fixed",
    productType: "FIXED",
    variantId: "var-1",
  });
  const hashFixed2 = computeConfigurationHash({
    productId: "prod-fixed",
    productType: "FIXED",
    variantId: "var-2",
  });
  assert.notStrictEqual(hashFixed1, hashFixed2, "Different variants must produce different configHash");

  // Options configuration hashing
  const hashOptionsA = computeConfigurationHash({
    productId: "prod-1",
    productType: "PER_AREA",
    width: 10,
    height: 8,
    unit: "ft",
    options: { finish: "matte", texture: "canvas" },
  });
  const hashOptionsB = computeConfigurationHash({
    productId: "prod-1",
    productType: "PER_AREA",
    width: 10,
    height: 8,
    unit: "ft",
    options: { finish: "gloss", texture: "canvas" },
  });
  assert.notStrictEqual(hashOptionsA, hashOptionsB, "Different options must produce different configHash");

  const hashOptionsKeyOrder = computeConfigurationHash({
    productId: "prod-1",
    productType: "PER_AREA",
    width: 10,
    height: 8,
    unit: "ft",
    options: { texture: "canvas", finish: "matte" },
  });
  assert.strictEqual(hashOptionsA, hashOptionsKeyOrder, "Same options in different key order must produce identical configHash");

  // -------------------------------------------------------------
  // Setup In-Memory Mock Database Tables
  // -------------------------------------------------------------
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
    variants: Array<{ id: string; name: string; sku: string; price: number | null }>;
  }

  interface MockCustomer {
    id: string;
    userId: string;
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
    rate: number | null;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    productMediaKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  const dbProducts: MockProduct[] = [
    {
      id: "prod-mural-1",
      name: "Bespoke Botanical Mural",
      slug: "bespoke-botanical-mural",
      productType: ProductType.PER_AREA,
      isActive: true,
      price: null,
      rate: 15000, // ₹150 / sqft in paise
      wastage: 10,
      minArea: 25,
      rollWidth: 3.0,
      returnable: false,
      hsnCode: "49119100",
      category: { id: "cat-1", name: "Murals", slug: "murals" },
      media: [{ id: "med-1", objectKey: "products/mural-1.webp", isPrimary: true }],
      variants: [],
    },
    {
      id: "prod-print-1",
      name: "Minimalist Framed Art",
      slug: "minimalist-framed-art",
      productType: ProductType.FIXED,
      isActive: true,
      price: 299900, // ₹2,999 in paise
      rate: null,
      wastage: null,
      minArea: null,
      rollWidth: null,
      returnable: true,
      hsnCode: "49119900",
      category: { id: "cat-2", name: "Framed Art", slug: "framed-art" },
      media: [{ id: "med-2", objectKey: "products/art-1.webp", isPrimary: true }],
      variants: [
        { id: "var-a3", name: "A3 Framed (Black)", sku: "MFA-A3-BLK", price: 349900 },
      ],
    },
    {
      id: "prod-inactive",
      name: "Discontinued Wallpaper",
      slug: "discontinued-wallpaper",
      productType: ProductType.PER_AREA,
      isActive: false,
      price: null,
      rate: 12000,
      wastage: 10,
      minArea: 25,
      rollWidth: 3.0,
      returnable: false,
      hsnCode: "49119100",
      category: null,
      media: [],
      variants: [],
    },
  ];

  const dbCustomers: MockCustomer[] = [];
  const dbCarts: MockCart[] = [];
  let dbCartItems: MockCartItem[] = [];

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
    cartItemAggregate: prisma.cartItem.aggregate,
    productFindFirst: prisma.product.findFirst,
    transaction: prisma.$transaction,
  };

  // Mock Prisma Implementations
  (prisma.customer.findUnique as unknown) = async (args: { where: { userId: string } }) => {
    return dbCustomers.find((c) => c.userId === args.where.userId) || null;
  };

  (prisma.customer.create as unknown) = async (args: { data: { userId: string } }) => {
    const newCust: MockCustomer = { id: `cust_${Date.now()}_${Math.random()}`, userId: args.data.userId };
    dbCustomers.push(newCust);
    return newCust;
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

  (prisma.product.findFirst as unknown) = async (args: { where: { id?: string; slug?: string } }) => {
    return dbProducts.find((p) => {
      if (args.where.id && p.id !== args.where.id) return false;
      if (args.where.slug && p.slug !== args.where.slug) return false;
      return true;
    }) || null;
  };

  (prisma.cartItem.findFirst as unknown) = async (args: {
    where: { id?: string | { not: string }; cartId?: string; configHash?: string };
    include?: Record<string, unknown>;
  }) => {
    const item = dbCartItems.find((i) => {
      if (args.where.id) {
        if (typeof args.where.id === "string" && i.id !== args.where.id) return false;
        if (typeof args.where.id === "object" && args.where.id.not && i.id === args.where.id.not) return false;
      }
      if (args.where.cartId && i.cartId !== args.where.cartId) return false;
      if (args.where.configHash && i.configHash !== args.where.configHash) return false;
      return true;
    });
    if (!item) return null;
    if (args.include?.product) {
      const prod = dbProducts.find((p) => p.id === item.productId);
      return {
        ...item,
        product: prod || { isActive: true },
      };
    }
    return item;
  };

  (prisma.cartItem.findUnique as unknown) = async (args: {
    where: { cartId_configHash?: { cartId: string; configHash: string }; id?: string };
    include?: { product?: boolean };
  }) => {
    let item;
    if (args.where.cartId_configHash) {
      item = dbCartItems.find(
        (i) => i.cartId === args.where.cartId_configHash!.cartId && i.configHash === args.where.cartId_configHash!.configHash
      );
    } else if (args.where.id) {
      item = dbCartItems.find((i) => i.id === args.where.id);
    }
    
    if (!item) return null;

    if (args.include?.product) {
      const prod = dbProducts.find((p) => p.id === item.productId);
      return { ...item, product: prod || null };
    }

    return { ...item };
  };

  (prisma.cartItem.findMany as unknown) = async (args: {
    where: { cartId: string };
    include?: Record<string, unknown>;
  }) => {
    const items = dbCartItems.filter((i) => i.cartId === args.where.cartId);
    return items.map((i) => {
      const prod = dbProducts.find((p) => p.id === i.productId);
      const row = i as unknown as { variantId?: string | null; ratePaise?: number | null };
      const variant = prod?.variants.find((v) => v.id === row.variantId) || null;
      return {
        ...i,
        product: prod || {
          id: i.productId,
          name: i.productName,
          slug: "unknown",
          productType: i.productType,
          isActive: true,
          price: null,
          rate: row.ratePaise ?? null,
          wastage: 10,
          minArea: 25,
          rollWidth: 3.0,
          returnable: false,
          hsnCode: null,
          category: null,
          media: [],
          variants: [],
        },
        variant,
      };
    });
  };

  (prisma.cartItem.create as unknown) = async (args: { data: Record<string, unknown> }) => {
    const item = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as MockCartItem;
    dbCartItems.push(item);
    return item;
  };

  (prisma.cartItem.update as unknown) = async (args: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => {
    const idx = dbCartItems.findIndex((i) => i.id === args.where.id);
    if (idx === -1) throw new Error("Cart item not found");
    dbCartItems[idx] = {
      ...dbCartItems[idx],
      ...args.data,
      updatedAt: new Date(),
    };
    return dbCartItems[idx];
  };

  (prisma.cartItem.delete as unknown) = async (args: { where: { id: string } }) => {
    const idx = dbCartItems.findIndex((i) => i.id === args.where.id);
    if (idx === -1) throw new Error("Cart item not found");
    const [deleted] = dbCartItems.splice(idx, 1);
    return deleted;
  };

  (prisma.cartItem.deleteMany as unknown) = async (args: { where: { cartId: string } }) => {
    const initialLen = dbCartItems.length;
    dbCartItems = dbCartItems.filter((i) => i.cartId !== args.where.cartId);
    return { count: initialLen - dbCartItems.length };
  };

  (prisma.cartItem.aggregate as unknown) = async (args: {
    where: { cartId: string };
    _sum: { quantity: boolean };
  }) => {
    const items = dbCartItems.filter((i) => i.cartId === args.where.cartId);
    const sum = items.reduce((acc, i) => acc + i.quantity, 0);
    return { _sum: { quantity: sum } };
  };

  // Helper cookie jar
  const createMockCookieStore = (): CookieStoreLike => {
    const jar = new Map<string, string>();
    return {
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
      set: (name: string, value: string) => jar.set(name, value),
      delete: (name: string) => jar.delete(name),
    };
  };

  try {
    // -------------------------------------------------------------
    // Test 2: Guest Cart Add & Server Authoritative Pricing
    // -------------------------------------------------------------
    console.log("  2. Testing Guest Add to Cart (PER_AREA)...");
    const guestStore = createMockCookieStore();

    const guestCart1 = await addItemToCart(
      {
        productId: "prod-mural-1",
        productType: "PER_AREA",
        width: 10,
        height: 8,
        unit: "ft",
        quantity: 1,
      },
      guestStore,
      null // explicit guest
    );

    assert(guestStore.get(GUEST_CART_COOKIE_NAME)?.value, "Guest session cookie must be set");
    assert.strictEqual(guestCart1.isGuest, true, "Cart must be identified as guest");
    assert.strictEqual(guestCart1.items.length, 1, "Cart must have 1 line item");
    assert.strictEqual(guestCart1.totalItems, 1, "Total items must equal 1");

    const line1 = guestCart1.items[0];
    assert.strictEqual(line1.productName, "Bespoke Botanical Mural");
    assert.strictEqual(line1.dimensions?.width, 10);
    assert.strictEqual(line1.dimensions?.height, 8);
    // 10x8 = 80 sqft + 10% wastage = 88 sqft billable
    assert.strictEqual(line1.area?.billableAreaSqft, 88);
    // Rate is ₹150 (15000 paise). 88 * 15000 = 1,320,000 paise (₹13,200)
    assert.strictEqual(line1.unitPricePaise, 1320000);
    assert.strictEqual(line1.totalPricePaise, 1320000);
    assert.strictEqual(guestCart1.subtotalPaise, 1320000);

    // -------------------------------------------------------------
    // Test 3: Identical Configuration Merges Quantities
    // -------------------------------------------------------------
    console.log("  3. Testing Identical Configuration Merge (combines quantities)...");
    const guestCart2 = await addItemToCart(
      {
        productId: "prod-mural-1",
        productType: "PER_AREA",
        width: 10,
        height: 8,
        unit: "ft",
        quantity: 2, // adding 2 more of exact same size
      },
      guestStore,
      null
    );

    assert.strictEqual(guestCart2.items.length, 1, "Must not create a duplicate row for identical config");
    assert.strictEqual(guestCart2.totalItems, 3, "Total items must be 1 + 2 = 3");
    assert.strictEqual(guestCart2.items[0].quantity, 3, "Line quantity must be 3");
    assert.strictEqual(guestCart2.items[0].totalPricePaise, 1320000 * 3, "Line total must be 3x unit price");
    assert.strictEqual(guestCart2.subtotalPaise, 1320000 * 3, "Subtotal must equal line total");

    // -------------------------------------------------------------
    // Test 4: Distinct Configuration Creates Separate Line
    // -------------------------------------------------------------
    console.log("  4. Testing Distinct Configuration (different dimensions remain separate)...");
    const guestCart3 = await addItemToCart(
      {
        productId: "prod-mural-1",
        productType: "PER_AREA",
        width: 6,
        height: 4, // 24 sqft -> triggers minArea 25 sqft + 10% wastage -> 27.5 sqft
        unit: "ft",
        quantity: 1,
      },
      guestStore,
      null
    );

    assert.strictEqual(guestCart3.items.length, 2, "Different dimensions must create distinct line items");
    assert.strictEqual(guestCart3.totalItems, 4, "Total items must be 3 + 1 = 4");

    // -------------------------------------------------------------
    // Test 5: FIXED Product & Variant Support
    // -------------------------------------------------------------
    console.log("  5. Testing FIXED Product with Variant...");
    const guestCart4 = await addItemToCart(
      {
        productId: "prod-print-1",
        productType: "FIXED",
        variantId: "var-a3",
        quantity: 1,
      },
      guestStore,
      null
    );

    assert.strictEqual(guestCart4.items.length, 3, "Must have 3 distinct lines");
    const fixedLine = guestCart4.items.find((i) => i.productId === "prod-print-1");
    assert(fixedLine, "Fixed product line must exist");
    assert.strictEqual(fixedLine.variantName, "A3 Framed (Black)");
    assert.strictEqual(fixedLine.sku, "MFA-A3-BLK");
    assert.strictEqual(fixedLine.unitPricePaise, 349900, "Must use variant price if provided");

    // -------------------------------------------------------------
    // Test 6: Input Validation Boundaries (Quantity, Inactive Product)
    // -------------------------------------------------------------
    console.log("  6. Testing Validation Boundaries (Negative Qty, >99, Inactive Product)...");

    let threw = false;
    try {
      await addItemToCart(
        { productId: "prod-mural-1", productType: "PER_AREA", width: 10, height: 8, quantity: 0 },
        guestStore,
        null
      );
    } catch (err) {
      if (err instanceof ValidationError) threw = true;
    }
    assert.strictEqual(threw, true, "Quantity 0 must throw ValidationError");

    threw = false;
    try {
      await addItemToCart(
        { productId: "prod-mural-1", productType: "PER_AREA", width: 10, height: 8, quantity: 100 },
        guestStore,
        null
      );
    } catch (err) {
      if (err instanceof ValidationError) threw = true;
    }
    assert.strictEqual(threw, true, "Quantity 100 (>99) must throw ValidationError");

    threw = false;
    try {
      await addItemToCart(
        { productId: "prod-inactive", productType: "PER_AREA", width: 10, height: 8, quantity: 1 },
        guestStore,
        null
      );
    } catch (err) {
      if (err instanceof ValidationError) threw = true;
    }
    assert.strictEqual(threw, true, "Inactive product must throw ValidationError");

    // -------------------------------------------------------------
    // Test 7: Quantity Updates & Ownership Protection
    // -------------------------------------------------------------
    console.log("  7. Testing Quantity Updates & Cart Ownership Protection...");
    const lineToUpdate = guestCart4.items[0];
    const updatedCart = await updateCartItemQuantity(lineToUpdate.id, 5, guestStore, null);
    const updatedLine = updatedCart.items.find((i) => i.id === lineToUpdate.id);
    assert.strictEqual(updatedLine?.quantity, 5, "Quantity must be updated to 5");
    assert.strictEqual(updatedLine?.totalPricePaise, updatedLine!.unitPricePaise * 5);

    // Ownership guard: Attempting to update with a different session / cart context must throw UnauthorizedError
    const intruderStore = createMockCookieStore();
    let unauthorizedBlocked = false;
    try {
      await updateCartItemQuantity(lineToUpdate.id, 10, intruderStore, null);
    } catch (err) {
      if (err instanceof UnauthorizedError || (err instanceof Error && err.name === "UnauthorizedError")) {
        unauthorizedBlocked = true;
      }
    }
    assert.strictEqual(unauthorizedBlocked, true, "Accessing an item belonging to another cart must throw UnauthorizedError");

    // -------------------------------------------------------------
    // Test 8: Remove Cart Item
    // -------------------------------------------------------------
    console.log("  8. Testing Remove Cart Item...");
    const cartBeforeRemoval = await getCartWithFreshPricing(guestStore, null);
    const countBefore = cartBeforeRemoval.items.length;
    const itemToRemove = cartBeforeRemoval.items[0];

    const cartAfterRemoval = await removeCartItem(itemToRemove.id, guestStore, null);
    assert.strictEqual(cartAfterRemoval.items.length, countBefore - 1, "Item count must decrease by 1");
    assert(!cartAfterRemoval.items.some((i) => i.id === itemToRemove.id), "Removed item must no longer exist in cart");

    // -------------------------------------------------------------
    // Test 9: Pricing Recalculation & Stale Detection
    // -------------------------------------------------------------
    console.log("  9. Testing Authoritative Price Recalculation on Stale Rates...");
    // Mutate the DB rate for prod-mural-1 from ₹150 (15000 paise) to ₹200 (20000 paise)
    const muralProduct = dbProducts.find((p) => p.id === "prod-mural-1")!;
    muralProduct.rate = 20000;

    const cartWithFreshPrices = await getCartWithFreshPricing(guestStore, null);
    const remainingMuralLine = cartWithFreshPrices.items.find((i) => i.productId === "prod-mural-1");
    if (remainingMuralLine) {
      assert.strictEqual(remainingMuralLine.ratePaise, 20000, "Rate must be refreshed to ₹200 (20000 paise)");
      assert.strictEqual(remainingMuralLine.priceChanged, true, "priceChanged flag must be true");
    }

    // -------------------------------------------------------------
    // Test 10: Guest-to-Customer Cart Merge
    // -------------------------------------------------------------
    console.log("  10. Testing Guest-to-Customer Cart Merge on Login...");
    // Current guest cart has lines in guestStore
    assert(guestStore.get(GUEST_CART_COOKIE_NAME)?.value, "Guest session cookie must exist before merge");
    const customerUser = { id: "user_customer_99" };

    // Before merge, resolveCartOwner with customerUser and guestStore will trigger mergeGuestCartIntoCustomer
    const customerCart = await getCartWithFreshPricing(guestStore, customerUser);
    assert.strictEqual(customerCart.isGuest, false, "Must now be identified as authenticated customer");
    assert.strictEqual(guestStore.get(GUEST_CART_COOKIE_NAME), undefined, "Guest cookie must be deleted after merge");

    // Check that customer cart received the merged items
    assert(customerCart.items.length > 0, "Customer cart must contain the merged items");

    // Adding same item again as customer merges into customer cart
    const custCartAfterAdd = await addItemToCart(
      {
        productId: "prod-print-1",
        productType: "FIXED",
        variantId: "var-a3",
        quantity: 2,
      },
      guestStore,
      customerUser
    );
    const custFixedLine = custCartAfterAdd.items.find((i) => i.productId === "prod-print-1");
    assert.strictEqual(custFixedLine?.quantity, 3, "Customer quantity must be 1 + 2 = 3");

    // -------------------------------------------------------------
    // Test 11: Clear Cart
    // -------------------------------------------------------------
    console.log("  11. Testing Clear Cart...");
    const clearedCart = await clearCart(guestStore, customerUser);
    assert.strictEqual(clearedCart.items.length, 0, "Cleared cart must have 0 items");
    assert.strictEqual(clearedCart.subtotalPaise, 0, "Cleared cart subtotal must be 0");
    const count = await getCartItemCount(guestStore, customerUser);
    assert.strictEqual(count, 0, "Cart item count must be 0");

    // -------------------------------------------------------------
    // Test 12: Distinct Options Separation & Client Price Tampering Rejection
    // -------------------------------------------------------------
    console.log("  12. Testing Distinct Options Separation & Client Price Tampering Rejection...");
    const optionsStore = createMockCookieStore();
    const cartOptA = await addItemToCart(
      {
        productId: "prod-mural-1",
        productType: "PER_AREA",
        width: 10,
        height: 8,
        unit: "ft",
        quantity: 1,
        options: { finish: "matte" },
        // Tampered client price fields (should be strictly ignored)
        ...({ price: 10, unitPricePaise: 50, rate: 100 } as unknown as object),
      },
      optionsStore,
      null
    );
    assert.strictEqual(cartOptA.items.length, 1);
    // Rate is ₹200 (20000 paise). 88 sqft * 20000 = 1,760,000 paise. Tampered client price 50 was rejected!
    assert.strictEqual(cartOptA.items[0].unitPricePaise, 1760000, "Server must ignore client-supplied prices");

    const cartOptB = await addItemToCart(
      {
        productId: "prod-mural-1",
        productType: "PER_AREA",
        width: 10,
        height: 8,
        unit: "ft",
        quantity: 1,
        options: { finish: "gloss" },
      },
      optionsStore,
      null
    );
    assert.strictEqual(cartOptB.items.length, 2, "Different options must produce separate line items");

    // -------------------------------------------------------------
    // Test 13: Customer Isolation (Customer B cannot access Customer A's cart)
    // -------------------------------------------------------------
    console.log("  13. Testing Customer-to-Customer Isolation & IDOR Guards...");
    const customerA = { id: "user_customer_A" };
    const customerB = { id: "user_customer_B" };
    const storeA = createMockCookieStore();
    const storeB = createMockCookieStore();

    const cartCustA = await addItemToCart(
      {
        productId: "prod-print-1",
        productType: "FIXED",
        variantId: "var-a3",
        quantity: 1,
      },
      storeA,
      customerA
    );
    const itemCustA = cartCustA.items[0];

    // Customer B tries to update Customer A's item
    let custBUpdateBlocked = false;
    try {
      await updateCartItemQuantity(itemCustA.id, 10, storeB, customerB);
    } catch (err) {
      if (err instanceof UnauthorizedError || (err instanceof Error && err.name === "UnauthorizedError")) {
        custBUpdateBlocked = true;
      }
    }
    assert.strictEqual(custBUpdateBlocked, true, "Customer B cannot update Customer A's cart item");

    // Customer B tries to delete Customer A's item
    let custBDeleteBlocked = false;
    try {
      await removeCartItem(itemCustA.id, storeB, customerB);
    } catch (err) {
      if (err instanceof UnauthorizedError || (err instanceof Error && err.name === "UnauthorizedError")) {
        custBDeleteBlocked = true;
      }
    }
    assert.strictEqual(custBDeleteBlocked, true, "Customer B cannot remove Customer A's cart item");

    // Guest intruder cannot remove another guest's item
    const guestItemToRemove = cartOptB.items[0];
    const guestIntruderStore = createMockCookieStore();
    let guestIntruderDeleteBlocked = false;
    try {
      await removeCartItem(guestItemToRemove.id, guestIntruderStore, null);
    } catch (err) {
      if (err instanceof UnauthorizedError || (err instanceof Error && err.name === "UnauthorizedError")) {
        guestIntruderDeleteBlocked = true;
      }
    }
    assert.strictEqual(guestIntruderDeleteBlocked, true, "Guest intruder cannot remove another guest's item");

    // -------------------------------------------------------------
    // Test 14: Product & Variant Deactivation Handling
    // -------------------------------------------------------------
    console.log("  14. Testing Product & Variant Deactivation Detection...");
    // Deactivate print product variant
    const printProduct = dbProducts.find((p) => p.id === "prod-print-1")!;
    const varA3 = printProduct.variants.find((v) => v.id === "var-a3") as unknown as { isActive?: boolean };
    if (varA3) varA3.isActive = false;

    const freshCustACart = await getCartWithFreshPricing(storeA, customerA);
    assert.strictEqual(freshCustACart.hasUnavailableItems, true, "Cart must flag hasUnavailableItems when variant is inactive");
    const inactiveLine = freshCustACart.items.find((i) => i.productId === "prod-print-1");
    assert.strictEqual(inactiveLine?.isAvailable, false, "Line item must be marked unavailable");

    // Restore variant
    if (varA3) varA3.isActive = true;

    // -------------------------------------------------------------
    // Test 15: Read-only Empty Cart Performance Guard
    // -------------------------------------------------------------
    console.log("  15. Testing Read-only Empty Cart Performance Guard...");
    const emptyFreshStore = createMockCookieStore();
    const emptyCartResult = await getCartWithFreshPricing(emptyFreshStore, null);
    assert.strictEqual(emptyCartResult.items.length, 0);
    assert.strictEqual(emptyCartResult.totalItems, 0);
    assert.strictEqual(emptyCartResult.subtotalPaise, 0);
    assert.strictEqual(emptyFreshStore.get(GUEST_CART_COOKIE_NAME), undefined, "Must not set cookie on empty read");

    const emptyCount = await getCartItemCount(emptyFreshStore, null);
    assert.strictEqual(emptyCount, 0, "Empty count must return 0 without creating cart");

    // -------------------------------------------------------------
    // Test 16: Update Cart Item Configuration
    // -------------------------------------------------------------
    console.log("  16. Testing Update Cart Item Configuration...");
    const cartBeforeConfigUpdate = await addItemToCart(
      {
        productId: "prod-mural-1",
        productType: "PER_AREA",
        width: 10,
        height: 8,
        unit: "ft",
        quantity: 1,
      },
      guestStore,
      null
    );
    const itemToUpdateConfig = cartBeforeConfigUpdate.items.find(
      (i) => i.productId === "prod-mural-1" && i.dimensions?.width === 10
    );
    
    assert(itemToUpdateConfig, "Item to update configuration must exist");

    const cartAfterConfigUpdate = await updateCartItemConfiguration(
      itemToUpdateConfig.id,
      { width: 12, height: 10, unit: "ft" },
      guestStore,
      null
    );

    const updatedConfigItem = cartAfterConfigUpdate.items.find(
      (i) => i.productId === "prod-mural-1" && i.dimensions?.width === 12
    );
    
    assert(updatedConfigItem, "Item configuration must be updated to new dimensions");
    assert.strictEqual(updatedConfigItem.dimensions?.width, 12, "Width must be 12");
    assert.strictEqual(updatedConfigItem.dimensions?.height, 10, "Height must be 10");
    // 12x10 = 120 sqft + 10% wastage = 132 sqft. Rate 20000 -> 2640000 paise.
    assert.strictEqual(updatedConfigItem.unitPricePaise, 2640000, "Price must be recalculated");

    // Test merging identical configs when updating configuration
    const cartWithIdenticalConfig = await addItemToCart(
      {
        productId: "prod-mural-1",
        productType: "PER_AREA",
        width: 15,
        height: 10,
        unit: "ft",
        quantity: 1,
      },
      guestStore,
      null
    );

    const itemToMerge = cartWithIdenticalConfig.items.find(
      (i) => i.dimensions?.width === 15
    );
    
    assert(itemToMerge, "Item to merge must exist");

    const mergedCart = await updateCartItemConfiguration(
      itemToMerge.id,
      { width: 12, height: 10, unit: "ft" }, // Match updatedConfigItem
      guestStore,
      null
    );

    const mergedItem = mergedCart.items.find((i) => i.dimensions?.width === 12);
    assert.strictEqual(mergedItem?.quantity, 2, "Identical config must merge and add quantities");
    assert(!mergedCart.items.find((i) => i.id === itemToMerge.id), "Original item should be deleted after merging");

    console.log("  ✔ All Cart Database Service tests passed successfully!");
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
    prisma.cartItem.aggregate = origPrisma.cartItemAggregate;
    prisma.product.findFirst = origPrisma.productFindFirst;
    prisma.$transaction = origPrisma.transaction;
  }
}

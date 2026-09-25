import assert from "node:assert/strict";
import { generateOrderNumber } from "../order-number";
import {
  placeRazorpayOrder,
  placeCodOrder,
  getOrderByNumber,
} from "../order-service";
import { generateTestRazorpaySignature } from "@/lib/payment/razorpay-service";
import { prisma } from "@/lib/prisma";
import {
  ProductType,
  PaymentMethod,
  PaymentStatus,
  FulfillmentStatus,
  CartStatus,
  CheckoutStatus,
  DiscountType,
} from "@prisma/client";
import { ValidationError, UnauthorizedError } from "@/lib/errors";

export async function runOrderTransactionTests() {
  console.log("--> Running Micro-Phase 07.06: Order Placement Transaction Tests...");

  // -------------------------------------------------------------
  // 1. Order Number Generation
  // -------------------------------------------------------------
  console.log("  1. Testing Order Number Generation...");
  const orderNum1 = generateOrderNumber();
  const orderNum2 = generateOrderNumber();
  assert.match(
    orderNum1,
    /^INW-\d{8}-[A-F0-9]{6}$/,
    "Order number must match format INW-YYYYMMDD-XXXXXX"
  );
  assert.notStrictEqual(orderNum1, orderNum2, "Successive order numbers must be unique");

  // -------------------------------------------------------------
  // 2. Setup Mock Database Store for Order Transactions
  // -------------------------------------------------------------
  console.log("  2. Setting up Mock Database Environment for Order Placement...");

  const mockDb = {
    customers: [
      {
        id: "cust-1",
        userId: "user-1",
      },
    ],
    products: [
      {
        id: "prod-mural-1",
        name: "Botanical Forest Mural",
        slug: "botanical-forest-mural",
        productType: ProductType.PER_AREA,
        isActive: true,
        price: null,
        rate: 15000, // ₹150 / sqft in paise
        wastage: 10,
        minArea: 25,
        rollWidth: 3.0,
        returnable: false,
        hsnCode: "49119100",
        variants: [],
      },
      {
        id: "prod-art-1",
        name: "Geometric Canvas Frame",
        slug: "geometric-canvas-frame",
        productType: ProductType.FIXED,
        isActive: true,
        price: 249900, // ₹2,499 in paise
        rate: null,
        wastage: null,
        minArea: null,
        rollWidth: null,
        returnable: true,
        hsnCode: "49119900",
        variants: [
          { id: "var-large", name: "Large (A2)", sku: "GCF-A2", price: 299900, isActive: true },
        ],
      },
    ],
    coupons: [
      {
        id: "cpn-save10",
        code: "SAVE10",
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        minCartValuePaise: 100000,
        maxDiscountPaise: 100000,
        startDate: null,
        expiryDate: null,
        usageLimit: 100,
        perCustomerLimit: 1,
        currentUsageCount: 0,
        isActive: true,
      },
    ],
    addresses: [
      {
        id: "addr-hyd-1",
        customerId: "cust-1",
        firstName: "Naveen",
        lastName: "Adicharla",
        addressLine1: "Road No 36, Jubilee Hills",
        addressLine2: "Apt 4B",
        city: "Hyderabad",
        state: "Telangana",
        postalCode: "500033",
        country: "IN",
        phone: "+91 98765 43210",
        isDefaultShipping: true,
        isDefaultBilling: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    carts: [
      {
        id: "cart-order-test",
        customerId: "cust-1",
        sessionId: null,
        status: CartStatus.ACTIVE,
        email: "naveen@example.com",
        phone: "+91 98765 43210",
        couponId: "cpn-save10" as string | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    cartItems: [
      {
        id: "ci-mural-1",
        cartId: "cart-order-test",
        productId: "prod-mural-1",
        productName: "Botanical Forest Mural",
        productType: ProductType.PER_AREA,
        variantId: null,
        variantName: null,
        sku: null,
        width: 10,
        height: 8,
        unit: "ft",
        widthFt: 10,
        heightFt: 8,
        enteredAreaSqft: 80,
        wastagePct: 10,
        wastageAreaSqft: 8,
        areaWithWastageSqft: 88,
        minAreaSqft: 25,
        isMinAreaApplied: false,
        billableAreaSqft: 88,
        rollWidthFt: 3,
        panelsNeeded: 4,
        ratePaise: 15000,
        unitPricePaise: 1320000, // ₹13,200
        quantity: 1,
        totalPricePaise: 1320000,
        options: { paperFinish: "Premium Matte" },
        mediaKey: "mural1.jpg",
        returnable: false,
        hsnCode: "49119100",
        configHash: "hash-mural",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ci-art-1",
        cartId: "cart-order-test",
        productId: "prod-art-1",
        productName: "Geometric Canvas Frame",
        productType: ProductType.FIXED,
        variantId: "var-large",
        variantName: "Large (A2)",
        sku: "GCF-A2",
        width: null,
        height: null,
        unit: null,
        widthFt: null,
        heightFt: null,
        enteredAreaSqft: null,
        wastagePct: null,
        wastageAreaSqft: null,
        areaWithWastageSqft: null,
        minAreaSqft: null,
        isMinAreaApplied: null,
        billableAreaSqft: null,
        rollWidthFt: null,
        panelsNeeded: null,
        ratePaise: null,
        unitPricePaise: 299900, // ₹2,999
        quantity: 2,
        totalPricePaise: 599800, // ₹5,998
        options: null,
        mediaKey: "art1.jpg",
        returnable: true,
        hsnCode: "49119900",
        configHash: "hash-art",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    checkoutSessions: [
      {
        id: "cs-order-test",
        cartId: "cart-order-test",
        customerId: "cust-1",
        sessionId: null,
        status: CheckoutStatus.ACTIVE,
        email: "naveen@example.com",
        phone: "+91 98765 43210",
        shippingAddressId: "addr-hyd-1",
        billingAddressId: "addr-hyd-1",
        deliveryOption: "Standard Delivery",
        deliveryAmountPaise: 0,
        paymentMethod: PaymentMethod.RAZORPAY as PaymentMethod,
        subtotalPaise: 1919800,
        taxAmountPaise: 310996,
        totalAmountPaise: 2038796,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    orders: [] as any[],
    orderItems: [] as any[],
    payments: [] as any[],
    couponUsages: [] as any[],
  };

  const originalFindUniqueCustomer = prisma.customer.findUnique;
  const originalCreateCustomer = prisma.customer.create;
  const originalFindUniqueOrder = prisma.order.findUnique;
  const originalCreateOrder = prisma.order.create;
  const originalUpdateOrder = prisma.order.update;
  const originalFindUniqueCart = prisma.cart.findUnique;
  const originalFindFirstCart = prisma.cart.findFirst;
  const originalUpdateCart = prisma.cart.update;
  const originalFindUniqueCheckout = prisma.checkoutSession.findUnique;
  const originalFindFirstCheckout = prisma.checkoutSession.findFirst;
  const originalUpdateCheckout = prisma.checkoutSession.update;
  const originalTransaction = prisma.$transaction;
  const originalFindUniqueCoupon = prisma.coupon.findUnique;
  const originalUpdateCoupon = prisma.coupon.update;
  const originalCouponUsage = (prisma as any).couponUsage;
  const originalFindUniqueAddress = prisma.address.findUnique;
  const originalFindManyCartItem = prisma.cartItem.findMany;
  const originalFindUniqueCartItem = prisma.cartItem.findUnique;
  const originalFindFirstCartItem = prisma.cartItem.findFirst;
  const originalCartItemUpdate = prisma.cartItem.update;
  const originalDeleteManyCartItem = prisma.cartItem.deleteMany;
  const originalProductFindMany = prisma.product.findMany;
  const originalProductFindFirst = prisma.product.findFirst;

  // Wire Prisma intercepts
  prisma.customer.findUnique = (async ({ where }: any) => {
    return mockDb.customers.find((c) => (where.id && c.id === where.id) || (where.userId && c.userId === where.userId)) || null;
  }) as any;

  prisma.customer.create = (async ({ data }: any) => {
    const c = { id: `cust_${data.userId}`, userId: data.userId };
    mockDb.customers.push(c);
    return c;
  }) as any;

  prisma.order.findUnique = (async ({ where }: any) => {
    if (where.id) return mockDb.orders.find((o) => o.id === where.id) || null;
    if (where.orderNumber) {
      const ord = mockDb.orders.find((o) => o.orderNumber === where.orderNumber);
      if (!ord) return null;
      return {
        ...ord,
        items: mockDb.orderItems.filter((oi) => oi.orderId === ord.id),
      };
    }
    if (where.razorpayPaymentId) return mockDb.orders.find((o) => o.razorpayPaymentId === where.razorpayPaymentId) || null;
    if (where.idempotencyKey) return mockDb.orders.find((o) => o.idempotencyKey === where.idempotencyKey) || null;
    return null;
  }) as any;

  prisma.order.create = (async ({ data }: any) => {
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newOrder = {
      id: orderId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.orders.push(newOrder);

    if (data.items?.create) {
      for (const item of data.items.create) {
        const itemRecord = {
          id: `oi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          orderId,
          ...item,
          createdAt: new Date(),
        };
        mockDb.orderItems.push(itemRecord);
      }
    }

    if (data.payments?.create) {
      mockDb.payments.push({
        id: `pay_${Date.now()}`,
        orderId,
        ...data.payments.create,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      ...newOrder,
      items: mockDb.orderItems.filter((i) => i.orderId === orderId),
    };
  }) as any;

  prisma.order.update = (async ({ where, data }: any) => {
    const ord = mockDb.orders.find((o) => o.id === where.id);
    if (ord) Object.assign(ord, data);
    return ord;
  }) as any;

  prisma.cart.findUnique = (async ({ where }: any) => {
    const cart = mockDb.carts.find((c) => c.id === where.id);
    if (!cart) return null;
    const items = mockDb.cartItems
      .filter((i) => i.cartId === cart.id)
      .map((item) => {
        const product = mockDb.products.find((p) => p.id === item.productId);
        const variant = product?.variants.find((v) => v.id === item.variantId) || null;
        return {
          ...item,
          product: product || { isActive: true, rate: item.ratePaise },
          variant,
        };
      });
    const coupon = mockDb.coupons.find((c) => c.id === cart.couponId) || null;
    return { ...cart, items, coupon };
  }) as any;

  prisma.cart.findFirst = (async ({ where }: any) => {
    const cart = mockDb.carts.find((c) => {
      if (where.customerId && c.customerId !== where.customerId) return false;
      if (where.sessionId && c.sessionId !== where.sessionId) return false;
      if (where.status && c.status !== where.status) return false;
      return true;
    });
    if (!cart) return null;
    return prisma.cart.findUnique({ where: { id: cart.id } });
  }) as any;

  prisma.cart.update = (async ({ where, data }: any) => {
    const cart = mockDb.carts.find((c) => c.id === where.id);
    if (cart) Object.assign(cart, data);
    return cart;
  }) as any;

  prisma.cartItem.findMany = (async ({ where }: any) => {
    return mockDb.cartItems
      .filter((i) => i.cartId === where.cartId)
      .map((item) => {
        const prod = mockDb.products.find((p) => p.id === item.productId);
        const variant = prod?.variants.find((v) => v.id === item.variantId) || null;
        return {
          ...item,
          product: prod || { isActive: true, rate: item.ratePaise },
          variant,
        };
      });
  }) as any;

  prisma.cartItem.update = (async ({ where, data }: any) => {
    const item = mockDb.cartItems.find((i) => i.id === where.id);
    if (item) Object.assign(item, data);
    return item;
  }) as any;

  prisma.cartItem.deleteMany = (async ({ where }: any) => {
    if (where.cartId) {
      mockDb.cartItems = mockDb.cartItems.filter((i) => i.cartId !== where.cartId);
    }
    return { count: 1 };
  }) as any;

  prisma.checkoutSession.findUnique = (async ({ where }: any) => {
    const session = mockDb.checkoutSessions.find((s) => s.id === where.id);
    if (!session) return null;
    const shippingAddress = mockDb.addresses.find((a) => a.id === session.shippingAddressId) || null;
    const billingAddress = mockDb.addresses.find((a) => a.id === session.billingAddressId) || null;
    const cart = await prisma.cart.findUnique({ where: { id: session.cartId } });
    return { ...session, shippingAddress, billingAddress, cart };
  }) as any;

  prisma.checkoutSession.findFirst = (async ({ where }: any) => {
    const session = mockDb.checkoutSessions.find(
      (s) => s.cartId === where.cartId && s.status === where.status
    );
    if (!session) return null;
    return prisma.checkoutSession.findUnique({ where: { id: session.id } });
  }) as any;

  prisma.checkoutSession.update = (async ({ where, data }: any) => {
    const session = mockDb.checkoutSessions.find((s) => s.id === where.id);
    if (session) Object.assign(session, data);
    return session;
  }) as any;

  prisma.coupon.findUnique = (async ({ where }: any) => {
    return mockDb.coupons.find((c) => c.id === where.id || c.code === where.code) || null;
  }) as any;

  prisma.coupon.update = (async ({ where, data }: any) => {
    const cpn = mockDb.coupons.find((c) => c.id === where.id);
    if (cpn && data.currentUsageCount?.increment) {
      cpn.currentUsageCount += data.currentUsageCount.increment;
    }
    return cpn;
  }) as any;

  (prisma as any).couponUsage = {
    create: async ({ data }: any) => {
      mockDb.couponUsages.push({ id: `cu_${Date.now()}`, ...data, usedAt: new Date() });
      return { id: `cu_${Date.now()}`, ...data };
    },
    count: async ({ where }: any) => {
      return mockDb.couponUsages.filter((cu) => {
        if (where?.couponId && cu.couponId !== where.couponId) return false;
        if (where?.customerId && cu.customerId !== where.customerId) return false;
        return true;
      }).length;
    },
  } as any;

  prisma.$transaction = (async (callback: any) => {
    return callback(prisma);
  }) as any;

  const mockUser = {
    id: "user-1",
    email: "naveen@example.com",
    role: "CUSTOMER" as const,
    customerId: "cust-1",
  };

  const mockCookieStore = {
    get: (key: string) => undefined,
    set: () => {},
    delete: () => {},
  };

  try {
    // -------------------------------------------------------------
    // 3. Razorpay Verified Payment Order Placement
    // -------------------------------------------------------------
    console.log("  3. Testing Verified Razorpay Online Order Placement...");

    const rzpOrderId = "order_test_rzp_12345";
    const rzpPaymentId = "pay_test_rzp_67890";
    const validSig = generateTestRazorpaySignature(rzpOrderId, rzpPaymentId);

    const orderResult = await placeRazorpayOrder(
      {
        checkoutId: "cs-order-test",
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: validSig,
      },
      mockCookieStore,
      mockUser
    );

    assert.strictEqual(orderResult.success, true, "Order placement must succeed");
    assert.ok(orderResult.orderNumber, "Order number must be assigned");
    assert.strictEqual(orderResult.paymentStatus, PaymentStatus.PAID, "Online order must be marked PAID");
    assert.strictEqual(orderResult.fulfillmentStatus, FulfillmentStatus.CONFIRMED, "Initial status must be CONFIRMED");
    assert.ok(orderResult.invoiceNumber, "GST Invoice must be generated and linked");

    // -------------------------------------------------------------
    // 4. Verify Immutable Order & Item Snapshots in Database
    // -------------------------------------------------------------
    console.log("  4. Verifying Immutable Order & Item Snapshots...");

    const savedOrder = mockDb.orders.find((o) => o.orderNumber === orderResult.orderNumber);
    assert.ok(savedOrder, "Order must be saved in database");
    assert.strictEqual(savedOrder.customerId, "cust-1");
    assert.strictEqual(savedOrder.customerEmail, "naveen@example.com");
    assert.strictEqual(savedOrder.shippingAddress.postalCode, "500033");
    assert.strictEqual(savedOrder.couponCode, "SAVE10");

    const savedItems = mockDb.orderItems.filter((i) => i.orderId === savedOrder.id);
    assert.strictEqual(savedItems.length, 2, "Must preserve both order items");

    // Check PER_AREA snapshot
    const muralItem = savedItems.find((i) => i.productType === ProductType.PER_AREA);
    assert.ok(muralItem, "Mural PER_AREA line item must exist");
    assert.strictEqual(muralItem.width, 10);
    assert.strictEqual(muralItem.height, 8);
    assert.strictEqual(muralItem.unit, "ft");
    assert.strictEqual(muralItem.billableAreaSqft, 88);
    assert.strictEqual(muralItem.ratePaise, 15000);
    assert.strictEqual(muralItem.unitPricePaise, 1320000);
    assert.strictEqual(muralItem.options.paperFinish, "Premium Matte");
    assert.ok(muralItem.taxableAmountPaise > 0);
    assert.strictEqual(muralItem.gstRatePct, 18);

    // Check FIXED snapshot
    const artItem = savedItems.find((i) => i.productType === ProductType.FIXED);
    assert.ok(artItem, "Canvas frame FIXED line item must exist");
    assert.strictEqual(artItem.variantName, "Large (A2)");
    assert.strictEqual(artItem.quantity, 2);
    assert.strictEqual(artItem.unitPricePaise, 299900);
    assert.strictEqual(artItem.totalPricePaise, 599800);

    // -------------------------------------------------------------
    // 5. Verify Cart Cleanup & Coupon Usage
    // -------------------------------------------------------------
    console.log("  5. Verifying Cart Cleanup & Coupon Usage...");

    const convertedCart = mockDb.carts.find((c) => c.id === "cart-order-test");
    assert.strictEqual(convertedCart?.status, CartStatus.CONVERTED, "Cart must be CONVERTED");
    assert.strictEqual(mockDb.cartItems.length, 0, "Cart items must be cleared post-order");

    const completedSession = mockDb.checkoutSessions.find((s) => s.id === "cs-order-test");
    assert.strictEqual(completedSession?.status, CheckoutStatus.COMPLETED, "Checkout session must be COMPLETED");

    assert.strictEqual(mockDb.couponUsages.length, 1, "Coupon usage must be recorded");
    assert.strictEqual(mockDb.coupons[0].currentUsageCount, 1, "Coupon usage count must increment");

    // -------------------------------------------------------------
    // 6. Test Idempotency on Repeated Request / Webhook Callback
    // -------------------------------------------------------------
    console.log("  6. Testing Idempotency on Repeated Payment Request...");

    const duplicateResult = await placeRazorpayOrder(
      {
        checkoutId: "cs-order-test",
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: validSig,
      },
      mockCookieStore,
      mockUser
    );

    assert.strictEqual(duplicateResult.success, true);
    assert.strictEqual(duplicateResult.orderNumber, orderResult.orderNumber, "Must return identical order number");
    assert.strictEqual(mockDb.orders.length, 1, "Must NOT create a duplicate order record");

    // -------------------------------------------------------------
    // 7. Test Cash on Delivery (COD) Order Placement
    // -------------------------------------------------------------
    console.log("  7. Testing Cash on Delivery (COD) Order Placement...");

    // Setup fresh cart and checkout session for COD test
    mockDb.carts.push({
      id: "cart-cod-test",
      customerId: "cust-1",
      sessionId: null,
      status: CartStatus.ACTIVE,
      email: "naveen@example.com",
      phone: "+91 98765 43210",
      couponId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockDb.cartItems.push({
      id: "ci-cod-1",
      cartId: "cart-cod-test",
      productId: "prod-art-1",
      productName: "Geometric Canvas Frame",
      productType: ProductType.FIXED,
      variantId: "var-large",
      variantName: "Large (A2)",
      sku: "GCF-A2",
      width: null,
      height: null,
      unit: null,
      widthFt: null,
      heightFt: null,
      enteredAreaSqft: null,
      wastagePct: null,
      wastageAreaSqft: null,
      areaWithWastageSqft: null,
      minAreaSqft: null,
      isMinAreaApplied: null,
      billableAreaSqft: null,
      rollWidthFt: null,
      panelsNeeded: null,
      ratePaise: null,
      unitPricePaise: 299900,
      quantity: 1,
      totalPricePaise: 299900,
      options: null,
      mediaKey: "art1.jpg",
      returnable: true,
      hsnCode: "49119900",
      configHash: "hash-art-cod",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockDb.checkoutSessions.push({
      id: "cs-cod-test",
      cartId: "cart-cod-test",
      customerId: "cust-1",
      sessionId: null,
      status: CheckoutStatus.ACTIVE,
      email: "naveen@example.com",
      phone: "+91 98765 43210",
      shippingAddressId: "addr-hyd-1",
      billingAddressId: "addr-hyd-1",
      deliveryOption: "Standard Delivery",
      deliveryAmountPaise: 0,
      paymentMethod: PaymentMethod.COD,
      subtotalPaise: 299900,
      taxAmountPaise: 45747,
      totalAmountPaise: 299900,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const codResult = await placeCodOrder(
      {
        checkoutId: "cs-cod-test",
      },
      mockCookieStore,
      mockUser
    );

    assert.strictEqual(codResult.success, true);
    assert.ok(codResult.orderNumber);
    assert.strictEqual(codResult.paymentStatus, PaymentStatus.UNPAID, "COD order must be UNPAID");
    assert.strictEqual(codResult.fulfillmentStatus, FulfillmentStatus.CONFIRMED);

    const savedCodOrder = mockDb.orders.find((o) => o.orderNumber === codResult.orderNumber);
    assert.ok(savedCodOrder);
    assert.strictEqual(savedCodOrder.paymentMethod, PaymentMethod.COD);
    assert.strictEqual(savedCodOrder.paymentStatus, PaymentStatus.UNPAID);

    // -------------------------------------------------------------
    // 8. Test Order Query & IDOR Authorization Gate
    // -------------------------------------------------------------
    console.log("  8. Testing Order Query & Authorization Security...");

    // Owner can access their order
    const fetchedOrder = await getOrderByNumber(
      codResult.orderNumber!,
      mockCookieStore,
      mockUser
    );
    assert.ok(fetchedOrder);
    assert.strictEqual(fetchedOrder.orderNumber, codResult.orderNumber);

    // Stranger cannot access another customer's order (IDOR protection)
    const strangerUser = {
      id: "user-stranger",
      email: "stranger@example.com",
      role: "CUSTOMER" as const,
      customerId: "cust-stranger",
    };

    await assert.rejects(
      async () => {
        await getOrderByNumber(codResult.orderNumber!, mockCookieStore, strangerUser);
      },
      (err: any) => err instanceof UnauthorizedError,
      "Unauthorized user must be blocked from accessing foreign orders"
    );

    // -------------------------------------------------------------
    // 9. Payment Verification Failure Safeguards
    // -------------------------------------------------------------
    console.log("  9. Testing Payment Verification Failure Safeguards...");

    await assert.rejects(
      async () => {
        await placeRazorpayOrder(
          {
            checkoutId: "cs-cod-test",
            razorpayOrderId: "order_fake",
            razorpayPaymentId: "pay_fake",
            razorpaySignature: "invalid_sig_123",
          },
          mockCookieStore,
          mockUser
        );
      },
      (err: any) => err instanceof ValidationError,
      "Invalid payment signature must be rejected"
    );

    console.log("  ✔ All Order Placement Transaction tests passed successfully!");
  } finally {
    // Restore prisma functions
    prisma.customer.findUnique = originalFindUniqueCustomer;
    prisma.customer.create = originalCreateCustomer;
    prisma.order.findUnique = originalFindUniqueOrder;
    prisma.order.create = originalCreateOrder;
    prisma.order.update = originalUpdateOrder;
    prisma.cart.findUnique = originalFindUniqueCart;
    prisma.cart.findFirst = originalFindFirstCart;
    prisma.cart.update = originalUpdateCart;
    prisma.checkoutSession.findUnique = originalFindUniqueCheckout;
    prisma.checkoutSession.findFirst = originalFindFirstCheckout;
    prisma.checkoutSession.update = originalUpdateCheckout;
    prisma.$transaction = originalTransaction;
    prisma.coupon.findUnique = originalFindUniqueCoupon;
    prisma.coupon.update = originalUpdateCoupon;
    (prisma as any).couponUsage = originalCouponUsage;
    prisma.address.findUnique = originalFindUniqueAddress;
    prisma.cartItem.findMany = originalFindManyCartItem;
    prisma.cartItem.findUnique = originalFindUniqueCartItem;
    prisma.cartItem.findFirst = originalFindFirstCartItem;
    prisma.cartItem.update = originalCartItemUpdate;
    prisma.cartItem.deleteMany = originalDeleteManyCartItem;
    prisma.product.findMany = originalProductFindMany;
    prisma.product.findFirst = originalProductFindFirst;
  }
}

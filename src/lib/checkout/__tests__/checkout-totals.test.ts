import assert from "node:assert";
import { calculateCheckoutTotals } from "../totals-engine";
import { DiscountType } from "@prisma/client";
import type { CouponData } from "@/lib/coupons/coupon-engine";
import type { ShippingRuleData } from "@/lib/shipping/types";

export function runCheckoutTotalsEngineTests() {
  console.log("--> Running Micro-Phase 07.02: Checkout Totals Engine Tests...");

  const mockShippingRules: ShippingRuleData[] = [
    {
      id: "rule-std",
      name: "Standard Shipping",
      pincodePattern: "*",
      shippingCostPaise: 15000, // ₹150
      freeShippingThresholdPaise: 150000, // ₹1,500
      isDeliverable: true,
      priority: 0,
      isActive: true,
    },
    {
      id: "rule-express-metro",
      name: "Express Metro Delivery",
      pincodePattern: "500*",
      shippingCostPaise: 10000, // ₹100
      freeShippingThresholdPaise: 100000, // ₹1,000
      isDeliverable: true,
      priority: 10,
      isActive: true,
    },
    {
      id: "rule-restricted",
      name: "Restricted Zone",
      pincodePattern: "111111",
      shippingCostPaise: 0,
      isDeliverable: false,
      priority: 50,
      isActive: true,
    },
  ];

  // -------------------------------------------------------------
  // Test 1: Basic Line Item Subtotal
  // -------------------------------------------------------------
  console.log("  1. Testing Line Item Subtotal Calculation...");
  const items = [
    {
      id: "item-1",
      productId: "prod-1",
      productName: "Custom Mural Wallpaper",
      productType: "PER_AREA" as const,
      unitPricePaise: 450000, // ₹4,500
      quantity: 1,
      totalPricePaise: 450000,
    },
    {
      id: "item-2",
      productId: "prod-2",
      productName: "Canvas Art Print",
      productType: "FIXED" as const,
      unitPricePaise: 120000, // ₹1,200
      quantity: 2,
      totalPricePaise: 240000,
    },
  ];

  // Subtotal = 450000 + 240000 = 690000 paise (₹6,900)
  const totalsPendingAddress = calculateCheckoutTotals({
    items,
    shippingRules: mockShippingRules,
  });

  assert.strictEqual(totalsPendingAddress.itemCount, 2);
  assert.strictEqual(totalsPendingAddress.totalQuantity, 3);
  assert.strictEqual(totalsPendingAddress.subtotalPaise, 690000);
  assert.strictEqual(totalsPendingAddress.couponDiscountPaise, 0);
  assert.strictEqual(totalsPendingAddress.shippingPaise, 0);
  assert.strictEqual(totalsPendingAddress.deliveryStatus, "PENDING_ADDRESS");
  assert.strictEqual(totalsPendingAddress.status, "VALID");
  assert.strictEqual(totalsPendingAddress.totalPayablePaise, 690000);

  // -------------------------------------------------------------
  // Test 2: Percentage Coupon Application
  // -------------------------------------------------------------
  console.log("  2. Testing Percentage Coupon Discount...");
  const percentageCoupon: CouponData = {
    id: "coupon-1",
    code: "SAVE10",
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10, // 10%
    minCartValuePaise: 100000, // ₹1,000
    maxDiscountPaise: 50000, // max ₹500
    currentUsageCount: 0,
    isActive: true,
  };

  // Subtotal: 690000 paise. 10% = 69000 paise. Capped at maxDiscount 50000 paise.
  const totalsWithCoupon = calculateCheckoutTotals({
    items,
    coupon: percentageCoupon,
    shippingAddress: { postalCode: "500001", state: "Telangana" },
    shippingRules: mockShippingRules,
  });

  assert.strictEqual(totalsWithCoupon.subtotalPaise, 690000);
  assert.strictEqual(totalsWithCoupon.couponDiscountPaise, 50000);
  assert.strictEqual(totalsWithCoupon.discountedSubtotalPaise, 640000);
  // Order is >= ₹1,000 threshold for metro -> Free shipping!
  assert.strictEqual(totalsWithCoupon.isFreeShipping, true);
  assert.strictEqual(totalsWithCoupon.shippingPaise, 0);
  assert.strictEqual(totalsWithCoupon.totalPayablePaise, 640000);

  // -------------------------------------------------------------
  // Test 3: Shipping Cost Below Threshold
  // -------------------------------------------------------------
  console.log("  3. Testing Shipping Cost below Free Shipping Threshold...");
  const smallItem = [
    {
      id: "item-3",
      productId: "prod-3",
      productName: "Sample Swatch",
      productType: "FIXED" as const,
      unitPricePaise: 49900, // ₹499
      quantity: 1,
      totalPricePaise: 49900,
    },
  ];

  // Address 400001 (Mumbai) -> Standard rule: ₹150 shipping (subtotal < ₹1,500)
  const totalsSmallOrder = calculateCheckoutTotals({
    items: smallItem,
    shippingAddress: { postalCode: "400001", state: "Maharashtra" },
    shippingRules: mockShippingRules,
  });

  assert.strictEqual(totalsSmallOrder.subtotalPaise, 49900);
  assert.strictEqual(totalsSmallOrder.shippingPaise, 15000);
  assert.strictEqual(totalsSmallOrder.isFreeShipping, false);
  assert.strictEqual(totalsSmallOrder.amountRemainingForFreeShippingPaise, 100100); // 150000 - 49900
  // Total payable: 49900 + 15000 = 64900 paise (₹649)
  assert.strictEqual(totalsSmallOrder.totalPayablePaise, 64900);

  // -------------------------------------------------------------
  // Test 4: Fixed Coupon & Subtotal Threshold Invalidation
  // -------------------------------------------------------------
  console.log("  4. Testing Fixed Coupon & Invalidation on Low Subtotal...");
  const bigCoupon: CouponData = {
    id: "coupon-2",
    code: "BIG2000",
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 200000, // ₹2,000
    minCartValuePaise: 500000, // Min ₹5,000
    currentUsageCount: 0,
    isActive: true,
  };

  // On small order of ₹499 (49900 paise), coupon is invalid (below ₹5,000)
  const totalsInvalidCoupon = calculateCheckoutTotals({
    items: smallItem,
    coupon: bigCoupon,
    shippingAddress: { postalCode: "400001", state: "Maharashtra" },
    shippingRules: mockShippingRules,
  });

  assert.strictEqual(totalsInvalidCoupon.couponDiscountPaise, 0);
  assert.ok(totalsInvalidCoupon.couponWarning?.includes("minimum cart value"));
  assert.strictEqual(totalsInvalidCoupon.totalPayablePaise, 49900 + 15000);

  // -------------------------------------------------------------
  // Test 5: Undeliverable Address Handling
  // -------------------------------------------------------------
  console.log("  5. Testing Undeliverable Address Handling...");
  const totalsUndeliverable = calculateCheckoutTotals({
    items,
    shippingAddress: { postalCode: "111111", state: "Delhi" },
    shippingRules: mockShippingRules,
  });

  assert.strictEqual(totalsUndeliverable.deliveryStatus, "UNDELIVERABLE");
  assert.strictEqual(totalsUndeliverable.isDeliverable, false);
  assert.strictEqual(totalsUndeliverable.status, "UNDELIVERABLE");
  assert.ok(totalsUndeliverable.errorMessage?.includes("not available"));

  // -------------------------------------------------------------
  // Test 6: Empty Cart and Unavailable Items Guards
  // -------------------------------------------------------------
  console.log("  6. Testing Empty Cart & Unavailable Items Guards...");
  const totalsEmpty = calculateCheckoutTotals({
    items: [],
  });
  assert.strictEqual(totalsEmpty.status, "INVALID");
  assert.strictEqual(totalsEmpty.errorMessage, "Your cart is empty.");

  const totalsUnavailable = calculateCheckoutTotals({
    items: [
      {
        id: "item-x",
        productId: "prod-x",
        productName: "Discontinued Wallpaper",
        productType: "PER_AREA" as const,
        unitPricePaise: 100000,
        quantity: 1,
        totalPricePaise: 100000,
        isAvailable: false,
      },
    ],
  });
  assert.strictEqual(totalsUnavailable.status, "INVALID");
  assert.ok(totalsUnavailable.errorMessage?.includes("no longer available"));

  console.log("  ✔ All Checkout Totals Engine tests passed successfully!");
}

import assert from "node:assert";
import { calculateCheckoutTotals } from "../totals-engine";
import { DiscountType } from "@prisma/client";
import type { CouponData } from "@/lib/coupons/coupon-engine";
import type { ShippingRuleData } from "@/lib/shipping/types";

export function runCheckoutTotalsEngineTests() {
  console.log("--> Running Micro-Phase 07.02 & 07.03: Checkout Totals Engine with GST Tests...");

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
  // Test 1: Basic Line Item Subtotal & GST
  // -------------------------------------------------------------
  console.log("  1. Testing Line Item Subtotal & Tax Calculation...");
  const items = [
    {
      id: "item-1",
      productId: "prod-1",
      productName: "Custom Mural Wallpaper",
      productType: "PER_AREA" as const,
      hsnCode: "4814",
      unitPricePaise: 450000, // ₹4,500
      quantity: 1,
      totalPricePaise: 450000,
    },
    {
      id: "item-2",
      productId: "prod-2",
      productName: "Canvas Art Print",
      productType: "FIXED" as const,
      hsnCode: "4911",
      unitPricePaise: 120000, // ₹1,200
      quantity: 2,
      totalPricePaise: 240000,
    },
  ];

  // Subtotal = 450000 + 240000 = 690000 paise (₹6,900)
  // Taxable: ₹6,900. 18% GST = 124200 paise (₹1,242)
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
  assert.strictEqual(totalsPendingAddress.subtotalBeforeTaxPaise, 690000);
  assert.strictEqual(totalsPendingAddress.taxAmountPaise, 124200);
  assert.strictEqual(totalsPendingAddress.totalPayablePaise, 814200); // 690000 + 124200

  // -------------------------------------------------------------
  // Test 2: Percentage Coupon Application & Tax Calculation
  // -------------------------------------------------------------
  console.log("  2. Testing Percentage Coupon Discount with GST...");
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

  // Subtotal: 690000 paise. 10% = 69000 paise. Capped at maxDiscount 50000 paise (₹500).
  // Discounted Subtotal: 640000 paise (₹6,400).
  // Free shipping in 500* zone.
  // Tax: 18% of 640000 = 115200 paise (₹1,152).
  // Total payable = 640000 + 115200 = 755200 paise (₹7,552).
  const totalsWithCoupon = calculateCheckoutTotals({
    items,
    coupon: percentageCoupon,
    shippingAddress: { postalCode: "500001", state: "Telangana" },
    shippingRules: mockShippingRules,
  });

  assert.strictEqual(totalsWithCoupon.subtotalPaise, 690000);
  assert.strictEqual(totalsWithCoupon.couponDiscountPaise, 50000);
  assert.strictEqual(totalsWithCoupon.discountedSubtotalPaise, 640000);
  assert.strictEqual(totalsWithCoupon.isFreeShipping, true);
  assert.strictEqual(totalsWithCoupon.shippingPaise, 0);
  assert.strictEqual(totalsWithCoupon.subtotalBeforeTaxPaise, 640000);
  assert.strictEqual(totalsWithCoupon.taxAmountPaise, 115200);
  assert.strictEqual(totalsWithCoupon.totalPayablePaise, 755200);

  // -------------------------------------------------------------
  // Test 3: Shipping Cost Below Threshold with Shipping GST
  // -------------------------------------------------------------
  console.log("  3. Testing Shipping Cost & Shipping GST...");
  const smallItem = [
    {
      id: "item-3",
      productId: "prod-3",
      productName: "Sample Swatch",
      productType: "FIXED" as const,
      hsnCode: "4814",
      unitPricePaise: 49900, // ₹499
      quantity: 1,
      totalPricePaise: 49900,
    },
  ];

  // Address 400001 (Mumbai) -> Standard rule: ₹150 shipping (15000 paise)
  // Taxable items: 49900 paise. Item 18% IGST: 8982 paise.
  // Taxable shipping: 15000 paise. Shipping 18% IGST: 2700 paise.
  // Total Tax: 8982 + 2700 = 11682 paise.
  // Total Payable: 49900 + 15000 + 11682 = 76582 paise.
  const totalsSmallOrder = calculateCheckoutTotals({
    items: smallItem,
    shippingAddress: { postalCode: "400001", state: "Maharashtra" },
    shippingRules: mockShippingRules,
  });

  assert.strictEqual(totalsSmallOrder.subtotalPaise, 49900);
  assert.strictEqual(totalsSmallOrder.shippingPaise, 15000);
  assert.strictEqual(totalsSmallOrder.isFreeShipping, false);
  assert.strictEqual(totalsSmallOrder.subtotalBeforeTaxPaise, 64900);
  assert.strictEqual(totalsSmallOrder.taxAmountPaise, 11682);
  assert.strictEqual(totalsSmallOrder.totalPayablePaise, 76582);

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
  assert.strictEqual(totalsInvalidCoupon.totalPayablePaise, 76582);

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

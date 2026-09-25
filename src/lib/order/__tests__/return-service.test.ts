import assert from "node:assert/strict";
import { checkReturnEligibility } from "../return-service";
import { Order, OrderItem, FulfillmentStatus, PaymentStatus, ProductType } from "@prisma/client";

const mockOrder = (fulfillmentStatus: FulfillmentStatus): Order => ({
  id: "order-1",
  orderNumber: "ORD-1",
  customerId: "cust-1",
  guestSessionId: null,
  customerEmail: "test@example.com",
  customerPhone: null,
  customerName: "Test User",
  shippingAddress: {},
  billingAddress: {},
  subtotalPaise: 1000,
  discountPaise: 0,
  shippingPaise: 0,
  taxPaise: 0,
  totalPaise: 1000,
  couponCode: null,
  couponSnapshot: null,
  taxBreakdown: null,
  shippingOption: null,
  paymentMethod: "RAZORPAY",
  paymentStatus: PaymentStatus.PAID,
  fulfillmentStatus,
  razorpayOrderId: null,
  razorpayPaymentId: null,
  razorpaySignature: null,
  idempotencyKey: null,
  invoiceNumber: null,
  invoiceUrl: null,
  invoiceR2Key: null,
  invoiceGeneratedAt: null,
  courierName: null,
  awb: null,
  trackingUrl: null,
  shippedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockItem = (id: string, returnable: boolean): OrderItem => ({
  id,
  orderId: "order-1",
  productId: "prod-1",
  variantId: null,
  productName: "Test Product",
  productSlug: "test-product",
  productType: ProductType.FIXED,
  variantName: null,
  sku: null,
  hsnCode: null,
  returnable,
  mediaKey: null,
  options: null,
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
  unitPricePaise: 500,
  quantity: 2,
  totalPricePaise: 1000,
  discountPaise: 0,
  taxableAmountPaise: 1000,
  gstRatePct: 18,
  cgstPaise: 90,
  sgstPaise: 90,
  igstPaise: 0,
  totalTaxPaise: 180,
  netTotalPaise: 1180,
  createdAt: new Date(),
});

export async function runReturnServiceTests() {
  console.log("--> Running Micro-Phase 08.06: Return Service Tests...");

  console.log("  1. Testing eligible return...");
  {
    const order = mockOrder(FulfillmentStatus.DELIVERED);
    const items = [mockItem("item-1", true)];
    const result = checkReturnEligibility(order, items);
    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.returnableItems.length, 1);
    assert.strictEqual(result.nonReturnableItems.length, 0);
  }

  console.log("  2. Testing ineligible return (invalid state)...");
  {
    const order = mockOrder(FulfillmentStatus.CONFIRMED);
    const items = [mockItem("item-1", true)];
    const result = checkReturnEligibility(order, items);
    assert.strictEqual(result.eligible, false);
    assert.match(result.reason || "", /invalid fulfillment state/);
  }

  console.log("  3. Testing ineligible return (no returnable items)...");
  {
    const order = mockOrder(FulfillmentStatus.DELIVERED);
    const items = [mockItem("item-1", false)];
    const result = checkReturnEligibility(order, items);
    assert.strictEqual(result.eligible, false);
    assert.match(result.reason || "", /No returnable items/);
    assert.strictEqual(result.nonReturnableItems.length, 1);
  }

  console.log("  4. Testing ineligible return (already requested)...");
  {
    const order = mockOrder(FulfillmentStatus.RETURN_REQUESTED);
    const items = [mockItem("item-1", true)];
    const result = checkReturnEligibility(order, items);
    assert.strictEqual(result.eligible, false);
    assert.match(result.reason || "", /Return already requested/);
  }

  console.log("  5. Testing separate returnable and non-returnable items...");
  {
    const order = mockOrder(FulfillmentStatus.DELIVERED);
    const items = [mockItem("item-1", true), mockItem("item-2", false)];
    const result = checkReturnEligibility(order, items);
    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.returnableItems.length, 1);
    assert.strictEqual(result.returnableItems[0].id, "item-1");
    assert.strictEqual(result.nonReturnableItems.length, 1);
    assert.strictEqual(result.nonReturnableItems[0].id, "item-2");
  }

  console.log("  ✔ All Return Service tests passed successfully!");
}

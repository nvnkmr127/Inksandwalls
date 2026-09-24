import {
  calculateCouponDiscount,
  type CouponData,
} from "@/lib/coupons/coupon-engine";
import {
  resolveShippingRule,
  DEFAULT_SHIPPING_RULE,
} from "@/lib/shipping/shipping-engine";
import type { ShippingRuleData } from "@/lib/shipping/types";

export interface CheckoutTotalsItemInput {
  id: string;
  productId: string;
  productName: string;
  productType: "PER_AREA" | "FIXED";
  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
  isAvailable?: boolean;
}

export interface CheckoutTotalsAddressInput {
  postalCode: string;
  state?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface CalculateCheckoutTotalsInput {
  items: CheckoutTotalsItemInput[];
  coupon?: CouponData | null;
  customerPreviousCouponUsageCount?: number;
  shippingAddress?: CheckoutTotalsAddressInput | null;
  shippingRules?: ShippingRuleData[];
}

export type DeliveryStatus = "PENDING_ADDRESS" | "DELIVERABLE" | "UNDELIVERABLE";
export type CheckoutTotalsStatus = "VALID" | "RECALCULATING" | "INVALID" | "UNDELIVERABLE";

export interface CheckoutTotalsResult {
  // Line & Cart Totals
  itemCount: number;
  totalQuantity: number;
  subtotalPaise: number;

  // Coupon Discount
  couponCode: string | null;
  couponDiscountPaise: number;
  couponWarning: string | null;
  discountedSubtotalPaise: number;

  // Shipping
  shippingPaise: number;
  isFreeShipping: boolean;
  freeShippingThresholdPaise: number | null;
  amountRemainingForFreeShippingPaise: number | null;
  appliedShippingRule: ShippingRuleData | null;
  deliveryStatus: DeliveryStatus;
  isDeliverable: boolean;
  deliveryError: string | null;

  // Taxes (Phase 07.03 placeholder)
  taxAmountPaise: number;

  // Final Amounts
  subtotalBeforeTaxPaise: number;
  totalPayablePaise: number;

  // Checkout Status
  status: CheckoutTotalsStatus;
  errorMessage: string | null;
}

/**
 * Single authoritative server-side checkout totals calculation engine.
 * Flow: Cart lines -> Subtotal -> Coupon discount -> Shipping -> Payable subtotal before tax
 */
export function calculateCheckoutTotals(
  input: CalculateCheckoutTotalsInput
): CheckoutTotalsResult {
  const { items, coupon, shippingAddress, shippingRules } = input;

  // 1. Calculate items subtotal and check availability
  let subtotalPaise = 0;
  let totalQuantity = 0;
  let hasUnavailableItems = false;

  for (const item of items) {
    if (item.isAvailable === false) {
      hasUnavailableItems = true;
    }
    const itemTotal = item.quantity * item.unitPricePaise;
    subtotalPaise += itemTotal;
    totalQuantity += item.quantity;
  }

  // 2. Validate and calculate Coupon discount
  let couponDiscountPaise = 0;
  let couponWarning: string | null = null;
  const couponCode = coupon ? coupon.code : null;

  if (coupon && subtotalPaise > 0) {
    const discountResult = calculateCouponDiscount(coupon, subtotalPaise);
    if (discountResult.eligible) {
      couponDiscountPaise = discountResult.discountPaise;
    } else {
      couponWarning = discountResult.error || "Coupon is not applicable to current cart.";
      couponDiscountPaise = 0;
    }
  }

  const discountedSubtotalPaise = Math.max(0, subtotalPaise - couponDiscountPaise);

  // 3. Resolve Shipping & Free Shipping Thresholds
  let shippingPaise = 0;
  let isFreeShipping = false;
  let freeShippingThresholdPaise: number | null = DEFAULT_SHIPPING_RULE.freeShippingThresholdPaise || null;
  let amountRemainingForFreeShippingPaise: number | null = null;
  let appliedShippingRule: ShippingRuleData | null = null;
  let deliveryStatus: DeliveryStatus = "PENDING_ADDRESS";
  let isDeliverable = true;
  let deliveryError: string | null = null;

  if (shippingAddress && shippingAddress.postalCode) {
    const shippingResult = resolveShippingRule({
      pincode: shippingAddress.postalCode,
      state: shippingAddress.state || null,
      subtotalPaise,
      rules: shippingRules,
    });

    appliedShippingRule = shippingResult.appliedRule;
    freeShippingThresholdPaise = shippingResult.freeShippingThresholdPaise;
    amountRemainingForFreeShippingPaise = shippingResult.amountRemainingForFreeShippingPaise;

    if (!shippingResult.isDeliverable) {
      deliveryStatus = "UNDELIVERABLE";
      isDeliverable = false;
      shippingPaise = 0;
      deliveryError = shippingResult.validationError || "Selected address is outside our delivery area.";
    } else {
      deliveryStatus = "DELIVERABLE";
      isDeliverable = true;
      shippingPaise = shippingResult.shippingPaise;
      isFreeShipping = shippingResult.isFreeShipping;
    }
  } else {
    // No address selected yet: show free shipping progress against default rule
    if (freeShippingThresholdPaise && freeShippingThresholdPaise > 0) {
      if (subtotalPaise >= freeShippingThresholdPaise) {
        amountRemainingForFreeShippingPaise = 0;
        isFreeShipping = true;
      } else {
        amountRemainingForFreeShippingPaise = Math.max(0, freeShippingThresholdPaise - subtotalPaise);
      }
    }
  }

  // 4. Tax (Reserved for Phase 07.03 GST)
  const taxAmountPaise = 0;

  // 5. Final Payable Subtotal
  const subtotalBeforeTaxPaise = discountedSubtotalPaise + shippingPaise;
  const totalPayablePaise = subtotalBeforeTaxPaise + taxAmountPaise;

  // 6. Overall Checkout State
  let status: CheckoutTotalsStatus = "VALID";
  let errorMessage: string | null = null;

  if (items.length === 0) {
    status = "INVALID";
    errorMessage = "Your cart is empty.";
  } else if (hasUnavailableItems) {
    status = "INVALID";
    errorMessage = "Some items in your cart are no longer available.";
  } else if (deliveryStatus === "UNDELIVERABLE") {
    status = "UNDELIVERABLE";
    errorMessage = deliveryError;
  }

  return {
    itemCount: items.length,
    totalQuantity,
    subtotalPaise,
    couponCode,
    couponDiscountPaise,
    couponWarning,
    discountedSubtotalPaise,
    shippingPaise,
    isFreeShipping,
    freeShippingThresholdPaise,
    amountRemainingForFreeShippingPaise,
    appliedShippingRule,
    deliveryStatus,
    isDeliverable,
    deliveryError,
    taxAmountPaise,
    subtotalBeforeTaxPaise,
    totalPayablePaise,
    status,
    errorMessage,
  };
}

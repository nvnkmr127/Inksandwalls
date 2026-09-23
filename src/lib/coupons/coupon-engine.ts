import { DiscountType } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

export interface CouponData {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number; // Percentage (1..100) or Fixed minor units (paise)
  minCartValuePaise?: number | null;
  maxDiscountPaise?: number | null;
  startDate?: Date | null;
  expiryDate?: Date | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  currentUsageCount: number;
  isActive: boolean;
}

export interface CouponValidationContext {
  subtotalPaise: number;
  customerPreviousUsageCount?: number;
  now?: Date;
}

export interface CouponDiscountResult {
  eligible: boolean;
  discountPaise: number;
  finalTotalPaise: number;
  error?: string;
}

/**
 * Normalizes coupon codes consistently across the application:
 * Trims leading/trailing whitespace and converts to uppercase alphanumeric.
 */
export function normalizeCouponCode(code: string | null | undefined): string {
  if (!code) return "";
  return code.trim().toUpperCase();
}

/**
 * Validates whether coupon code string has valid format.
 */
export function validateCouponCodeFormat(code: string): string {
  const normalized = normalizeCouponCode(code);
  if (!normalized) {
    throw new ValidationError("Coupon code is required.");
  }
  // Allow uppercase alphanumeric with hyphens or underscores
  if (!/^[A-Z0-9_-]{2,32}$/.test(normalized)) {
    throw new ValidationError("Coupon code must be 2-32 alphanumeric characters.");
  }
  return normalized;
}

/**
 * Evaluates coupon eligibility against validation context without mutating state.
 * Validates:
 * - Active state
 * - Server-authoritative start & expiry dates
 * - Global usage limit
 * - Customer-specific usage limit
 * - Minimum cart value
 * - Positive subtotal
 */
export function validateCouponEligibility(
  coupon: CouponData,
  context: CouponValidationContext
): { valid: boolean; error?: string } {
  const now = context.now || new Date();

  // 1. Active status check
  if (!coupon.isActive) {
    return { valid: false, error: "This coupon is currently inactive." };
  }

  // 2. Start date check (server time)
  if (coupon.startDate && now < coupon.startDate) {
    return { valid: false, error: "This coupon promotion has not started yet." };
  }

  // 3. Expiry date check (server time)
  if (coupon.expiryDate && now > coupon.expiryDate) {
    return { valid: false, error: "This coupon has expired." };
  }

  // 4. Global usage limit check
  if (coupon.usageLimit != null && coupon.currentUsageCount >= coupon.usageLimit) {
    return { valid: false, error: "This coupon has reached its maximum usage limit." };
  }

  // 5. Per-customer usage limit check
  if (
    coupon.perCustomerLimit != null &&
    (context.customerPreviousUsageCount ?? 0) >= coupon.perCustomerLimit
  ) {
    return { valid: false, error: "You have reached the maximum usage limit for this coupon." };
  }

  // 6. Subtotal check
  if (context.subtotalPaise <= 0) {
    return { valid: false, error: "Cart subtotal must be greater than zero to apply a coupon." };
  }

  // 7. Minimum cart value check
  if (
    coupon.minCartValuePaise != null &&
    coupon.minCartValuePaise > 0 &&
    context.subtotalPaise < coupon.minCartValuePaise
  ) {
    const minRupees = Math.ceil(coupon.minCartValuePaise / 100);
    return {
      valid: false,
      error: `This coupon requires a minimum cart value of ₹${minRupees.toLocaleString("en-IN")}.`,
    };
  }

  return { valid: true };
}

/**
 * Calculates authoritative coupon discount from subtotal.
 * Enforces PRD rules:
 * - Percentage: calculates (subtotal * value) / 100, caps at maxDiscount if configured
 * - Fixed: applies fixed amount up to subtotal
 * - Prevents negative totals under all conditions
 * - Separated cleanly from product line calculations
 */
export function calculateCouponDiscount(
  coupon: CouponData,
  subtotalPaise: number
): CouponDiscountResult {
  const eligibility = validateCouponEligibility(coupon, { subtotalPaise });
  if (!eligibility.valid) {
    return {
      eligible: false,
      discountPaise: 0,
      finalTotalPaise: subtotalPaise,
      error: eligibility.error,
    };
  }

  let discountPaise = 0;

  if (coupon.discountType === DiscountType.PERCENTAGE) {
    if (coupon.discountValue <= 0 || coupon.discountValue > 100) {
      return {
        eligible: false,
        discountPaise: 0,
        finalTotalPaise: subtotalPaise,
        error: "Invalid percentage discount value.",
      };
    }
    // Calculate percentage discount
    const calculated = Math.round((subtotalPaise * coupon.discountValue) / 100);
    // Apply configured maximum discount cap if present
    if (coupon.maxDiscountPaise != null && coupon.maxDiscountPaise > 0) {
      discountPaise = Math.min(calculated, coupon.maxDiscountPaise);
    } else {
      discountPaise = calculated;
    }
  } else if (coupon.discountType === DiscountType.FIXED_AMOUNT) {
    if (coupon.discountValue <= 0) {
      return {
        eligible: false,
        discountPaise: 0,
        finalTotalPaise: subtotalPaise,
        error: "Invalid fixed discount value.",
      };
    }
    discountPaise = coupon.discountValue;
  } else {
    return {
      eligible: false,
      discountPaise: 0,
      finalTotalPaise: subtotalPaise,
      error: "Unsupported discount type.",
    };
  }

  // Never allow discount to exceed the cart subtotal
  const cappedDiscount = Math.min(discountPaise, subtotalPaise);
  const finalTotalPaise = Math.max(0, subtotalPaise - cappedDiscount);

  return {
    eligible: true,
    discountPaise: cappedDiscount,
    finalTotalPaise,
  };
}

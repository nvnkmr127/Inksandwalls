import { DiscountType } from "@prisma/client";
import { ValidationError } from "@/lib/errors";
import { validateCouponCodeFormat } from "./coupon-engine";

export interface CouponInput {
  code: string;
  discountType: DiscountType | "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  minCartValuePaise?: number | null;
  maxDiscountPaise?: number | null;
  startDate?: string | Date | null;
  expiryDate?: string | Date | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  isActive?: boolean;
}

export interface ValidatedCouponData {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minCartValuePaise: number | null;
  maxDiscountPaise: number | null;
  startDate: Date | null;
  expiryDate: Date | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  isActive: boolean;
}

/**
 * Validates and normalizes coupon mutation payloads server-side.
 */
export function validateCouponInput(input: unknown): ValidatedCouponData {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Invalid request body. Expected an object.");
  }

  const data = input as Record<string, unknown>;

  // 1. Validate & Normalize Code
  if (typeof data.code !== "string") {
    throw new ValidationError("Coupon code is required.");
  }
  const code = validateCouponCodeFormat(data.code);

  // 2. Validate Discount Type
  if (
    data.discountType !== DiscountType.PERCENTAGE &&
    data.discountType !== DiscountType.FIXED_AMOUNT &&
    data.discountType !== "PERCENTAGE" &&
    data.discountType !== "FIXED_AMOUNT"
  ) {
    throw new ValidationError("Discount type must be either PERCENTAGE or FIXED_AMOUNT.");
  }
  const discountType = data.discountType as DiscountType;

  // 3. Validate Discount Value
  if (typeof data.discountValue !== "number" || isNaN(data.discountValue)) {
    throw new ValidationError("Discount value is required and must be a number.");
  }
  const discountValue = Math.round(data.discountValue);

  if (discountType === DiscountType.PERCENTAGE) {
    if (discountValue < 1 || discountValue > 100) {
      throw new ValidationError("Percentage discount must be between 1% and 100%.");
    }
  } else if (discountType === DiscountType.FIXED_AMOUNT) {
    if (discountValue <= 0) {
      throw new ValidationError("Fixed discount amount must be greater than zero.");
    }
  }

  // 4. Validate Minimum Cart Value (in paise)
  let minCartValuePaise: number | null = null;
  if (data.minCartValuePaise !== undefined && data.minCartValuePaise !== null) {
    if (typeof data.minCartValuePaise !== "number" || isNaN(data.minCartValuePaise)) {
      throw new ValidationError("Minimum cart value must be a valid number.");
    }
    const val = Math.round(data.minCartValuePaise);
    if (val < 0) {
      throw new ValidationError("Minimum cart value cannot be negative.");
    }
    minCartValuePaise = val > 0 ? val : null;
  }

  // 5. Validate Maximum Discount (in paise)
  let maxDiscountPaise: number | null = null;
  if (data.maxDiscountPaise !== undefined && data.maxDiscountPaise !== null) {
    if (typeof data.maxDiscountPaise !== "number" || isNaN(data.maxDiscountPaise)) {
      throw new ValidationError("Maximum discount must be a valid number.");
    }
    const val = Math.round(data.maxDiscountPaise);
    if (val <= 0) {
      throw new ValidationError("Maximum discount must be greater than zero.");
    }
    // Only percentage discounts apply maxDiscount cap
    if (discountType === DiscountType.PERCENTAGE) {
      maxDiscountPaise = val;
    }
  }

  // 6. Validate Start Date
  let startDate: Date | null = null;
  if (data.startDate !== undefined && data.startDate !== null && data.startDate !== "") {
    const parsed = new Date(data.startDate as string | number | Date);
    if (isNaN(parsed.getTime())) {
      throw new ValidationError("Invalid start date format.");
    }
    startDate = parsed;
  }

  // 7. Validate Expiry Date
  let expiryDate: Date | null = null;
  if (data.expiryDate !== undefined && data.expiryDate !== null && data.expiryDate !== "") {
    const parsed = new Date(data.expiryDate as string | number | Date);
    if (isNaN(parsed.getTime())) {
      throw new ValidationError("Invalid expiry date format.");
    }
    expiryDate = parsed;
  }

  // Date chronological consistency
  if (startDate && expiryDate && expiryDate.getTime() <= startDate.getTime()) {
    throw new ValidationError("Expiry date must be after the start date.");
  }

  // 8. Validate Global Usage Limit
  let usageLimit: number | null = null;
  if (data.usageLimit !== undefined && data.usageLimit !== null && data.usageLimit !== "") {
    if (typeof data.usageLimit !== "number" || isNaN(data.usageLimit) || !Number.isInteger(data.usageLimit)) {
      throw new ValidationError("Usage limit must be a positive whole integer.");
    }
    if (data.usageLimit < 1) {
      throw new ValidationError("Usage limit must be at least 1.");
    }
    usageLimit = data.usageLimit;
  }

  // 9. Validate Per-Customer Usage Limit
  let perCustomerLimit: number | null = null;
  if (data.perCustomerLimit !== undefined && data.perCustomerLimit !== null && data.perCustomerLimit !== "") {
    if (
      typeof data.perCustomerLimit !== "number" ||
      isNaN(data.perCustomerLimit) ||
      !Number.isInteger(data.perCustomerLimit)
    ) {
      throw new ValidationError("Per-customer usage limit must be a positive whole integer.");
    }
    if (data.perCustomerLimit < 1) {
      throw new ValidationError("Per-customer usage limit must be at least 1.");
    }
    perCustomerLimit = data.perCustomerLimit;
  }

  // 10. Validate isActive
  let isActive = true;
  if (data.isActive !== undefined) {
    if (typeof data.isActive !== "boolean") {
      throw new ValidationError("isActive must be a boolean value.");
    }
    isActive = data.isActive;
  }

  return {
    code,
    discountType,
    discountValue,
    minCartValuePaise,
    maxDiscountPaise,
    startDate,
    expiryDate,
    usageLimit,
    perCustomerLimit,
    isActive,
  };
}

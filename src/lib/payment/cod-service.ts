import "server-only";
import { getCodConfig } from "./cod-config";
import type {
  CodEligibilityResult,
  CodEligibilityReason,
  CodPaymentPreparation,
  CodConfig,
} from "./types";
import {
  recalculateCheckoutSession,
  type CheckoutSessionSnapshot,
} from "@/lib/checkout/checkout-service";
import { type CookieStoreLike } from "@/lib/cart/cart-service";
import { type CurrentUser } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export interface CheckCodEligibilityInput {
  pincode?: string | null;
  totalAmountPaise: number;
  isDeliverable?: boolean;
  config?: CodConfig;
}

/**
 * Pure evaluation function for Cash on Delivery (COD) eligibility.
 */
export function checkCodEligibility(
  input: CheckCodEligibilityInput
): CodEligibilityResult {
  const config = input.config || getCodConfig();

  if (!config.enabled) {
    return {
      eligible: false,
      reason: "COD_DISABLED",
      message: "Cash on Delivery is currently unavailable.",
    };
  }

  if (input.isDeliverable === false) {
    return {
      eligible: false,
      reason: "DELIVERY_NOT_SERVICEABLE",
      message: "Delivery is not serviceable for the specified location.",
    };
  }

  const pincode = input.pincode?.trim();
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return {
      eligible: false,
      reason: "INVALID_PINCODE",
      message: "A valid 6-digit PIN code is required for Cash on Delivery.",
    };
  }

  if (config.blockedPincodes && config.blockedPincodes.includes(pincode)) {
    return {
      eligible: false,
      reason: "PINCODE_NOT_ELIGIBLE",
      message: `Cash on Delivery is not available for PIN code ${pincode}.`,
    };
  }

  if (
    config.allowedPincodes &&
    config.allowedPincodes.length > 0 &&
    !config.allowedPincodes.includes(pincode)
  ) {
    return {
      eligible: false,
      reason: "PINCODE_NOT_ELIGIBLE",
      message: `Cash on Delivery is not available for PIN code ${pincode}.`,
    };
  }

  if (
    config.minOrderValuePaise != null &&
    input.totalAmountPaise < config.minOrderValuePaise
  ) {
    const minRs = Math.round(config.minOrderValuePaise / 100);
    return {
      eligible: false,
      reason: "ORDER_VALUE_BELOW_MINIMUM",
      message: `Minimum order value for Cash on Delivery is ₹${minRs.toLocaleString("en-IN")}.`,
      minOrderValuePaise: config.minOrderValuePaise,
    };
  }

  if (
    config.maxOrderValuePaise != null &&
    input.totalAmountPaise > config.maxOrderValuePaise
  ) {
    const maxRs = Math.round(config.maxOrderValuePaise / 100);
    return {
      eligible: false,
      reason: "ORDER_VALUE_ABOVE_MAXIMUM",
      message: `Maximum order value for Cash on Delivery is ₹${maxRs.toLocaleString("en-IN")}. Please pay online for higher value orders.`,
      maxOrderValuePaise: config.maxOrderValuePaise,
    };
  }

  return {
    eligible: true,
    reason: "COD_AVAILABLE",
    message: "Cash on Delivery is available for your order.",
    minOrderValuePaise: config.minOrderValuePaise,
    maxOrderValuePaise: config.maxOrderValuePaise,
  };
}

/**
 * Validates and prepares a checkout session for Cash on Delivery payment.
 */
export async function validateAndPrepareCodCheckout(
  checkoutId: string,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<{
  preparation: CodPaymentPreparation;
  session: CheckoutSessionSnapshot;
}> {
  const session = await recalculateCheckoutSession(checkoutId, customStore, customUser);

  if (!session.shippingAddressId || !session.shippingAddress) {
    throw new ValidationError("Shipping address is required before selecting COD.");
  }

  if (!session.totals.isDeliverable) {
    throw new ValidationError("Selected delivery location is not serviceable.");
  }

  const eligibility = checkCodEligibility({
    pincode: session.shippingAddress.postalCode,
    totalAmountPaise: session.totals.totalPayablePaise,
    isDeliverable: session.totals.isDeliverable,
  });

  if (!eligibility.eligible) {
    throw new ValidationError(eligibility.message);
  }

  return {
    preparation: {
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      totalAmountPaise: session.totals.totalPayablePaise,
      currency: "INR",
      isEligible: true,
      reason: eligibility.reason,
    },
    session,
  };
}

export type PaymentMethod = "RAZORPAY" | "COD";

export type PaymentStatus =
  | "PENDING"
  | "UNPAID"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

export type CodEligibilityReason =
  | "COD_AVAILABLE"
  | "COD_DISABLED"
  | "INVALID_PINCODE"
  | "PINCODE_NOT_ELIGIBLE"
  | "ORDER_VALUE_BELOW_MINIMUM"
  | "ORDER_VALUE_ABOVE_MAXIMUM"
  | "DELIVERY_NOT_SERVICEABLE";

export interface CodEligibilityResult {
  eligible: boolean;
  reason: CodEligibilityReason;
  message: string;
  minOrderValuePaise?: number | null;
  maxOrderValuePaise?: number | null;
}

export interface CodConfig {
  enabled: boolean;
  minOrderValuePaise?: number | null;
  maxOrderValuePaise?: number | null;
  allowedPincodes?: string[];
  blockedPincodes?: string[];
}

export interface CodPaymentPreparation {
  paymentMethod: "COD";
  paymentStatus: "PENDING" | "UNPAID";
  totalAmountPaise: number;
  currency: "INR";
  isEligible: boolean;
  reason: CodEligibilityReason;
}

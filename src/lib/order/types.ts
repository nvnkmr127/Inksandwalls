import type {
  PaymentMethod,
  PaymentStatus,
  FulfillmentStatus,
  ProductType,
} from "@prisma/client";
import type { TaxBreakdownResult } from "@/lib/checkout/totals-engine";
import type { CouponData } from "@/lib/coupons/coupon-engine";

export interface AddressSnapshot {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
}

export interface OrderItemSnapshot {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  productType: ProductType;
  variantId: string | null;
  variantName: string | null;
  sku: string | null;
  hsnCode: string | null;
  returnable: boolean;
  mediaKey: string | null;
  options: Record<string, unknown> | null;
  // Dimensions for PER_AREA
  width: number | null;
  height: number | null;
  unit: string | null;
  widthFt: number | null;
  heightFt: number | null;
  enteredAreaSqft: number | null;
  wastagePct: number | null;
  wastageAreaSqft: number | null;
  areaWithWastageSqft: number | null;
  minAreaSqft: number | null;
  isMinAreaApplied: boolean | null;
  billableAreaSqft: number | null;
  rollWidthFt: number | null;
  panelsNeeded: number | null;
  ratePaise: number | null;
  // Pricing
  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  gstRatePct: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  netTotalPaise: number;
}

export interface OrderSnapshot {
  id: string;
  orderNumber: string;
  customerId: string | null;
  guestSessionId: string | null;
  customerEmail: string;
  customerPhone: string | null;
  customerName: string;
  shippingAddress: AddressSnapshot;
  billingAddress: AddressSnapshot;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  couponCode: string | null;
  couponSnapshot: CouponData | null;
  taxBreakdown: TaxBreakdownResult | null;
  shippingOption: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  invoiceR2Key: string | null;
  invoiceGeneratedAt: Date | null;
  items: OrderItemSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceRazorpayOrderInput {
  checkoutId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface PlaceCodOrderInput {
  checkoutId: string;
  idempotencyKey?: string;
}

export interface OrderPlacementResult {
  success: boolean;
  orderNumber?: string;
  orderId?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  totalPaise?: number;
  invoiceNumber?: string | null;
  invoiceUrl?: string | null;
  error?: string;
}

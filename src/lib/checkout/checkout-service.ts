import "server-only";
import { prisma } from "@/lib/prisma";
import { CheckoutStatus } from "@prisma/client";
import {
  getCartWithFreshPricing,
  resolveCartOwner,
  CookieStoreLike,
} from "@/lib/cart/cart-service";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { ValidationError, UnauthorizedError, NotFoundError } from "@/lib/errors";
import { cookies } from "next/headers";
import {
  validateAddressInput,
  type AddressInput,
} from "@/lib/address/address-schema";
import {
  calculateCheckoutTotals,
  type CheckoutTotalsResult,
} from "./totals-engine";
import { getActiveShippingRules } from "@/lib/shipping/shipping-service";
import type { CouponData } from "@/lib/coupons/coupon-engine";
import { checkCodEligibility } from "@/lib/payment/cod-service";
import type { CodEligibilityResult, PaymentMethod } from "@/lib/payment/types";

export interface CheckoutSessionSnapshot {
  id: string;
  cartId: string;
  customerId: string | null;
  sessionId: string | null;
  status: CheckoutStatus;
  email: string;
  phone: string | null;
  shippingAddressId: string | null;
  billingAddressId: string | null;
  shippingAddress: {
    id: string;
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string | null;
  } | null;
  billingAddress: {
    id: string;
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string | null;
  } | null;
  cart: {
    id: string;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      productType: "PER_AREA" | "FIXED";
      unitPricePaise: number;
      quantity: number;
      totalPricePaise: number;
      variantName: string | null;
      width: number | null;
      height: number | null;
      unit: string | null;
    }>;
    coupon: CouponData | null;
  };
  totals: CheckoutTotalsResult;
  paymentMethod: PaymentMethod | null;
  codEligibility: CodEligibilityResult;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Initiates or retrieves an existing active checkout session for the user's cart.
 */
export async function startCheckout(
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<CheckoutSessionSnapshot> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();
  const owner = await resolveCartOwner(cookieStore, currentUser);

  // Authoritative fresh cart pricing
  const cartView = await getCartWithFreshPricing(cookieStore, currentUser);

  if (!cartView || cartView.items.length === 0) {
    throw new ValidationError("Your cart is empty.");
  }

  if (cartView.hasUnavailableItems) {
    throw new ValidationError("Some items in your cart are currently unavailable.");
  }

  // Find existing active checkout for this cart
  let checkoutSession = await prisma.checkoutSession.findFirst({
    where: {
      cartId: cartView.cartId,
      status: CheckoutStatus.ACTIVE,
    },
    include: {
      shippingAddress: true,
      billingAddress: true,
    },
  });

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

  if (!checkoutSession) {
    checkoutSession = await prisma.checkoutSession.create({
      data: {
        cartId: cartView.cartId,
        customerId: owner.type === "CUSTOMER" ? owner.customerId : null,
        sessionId: owner.type === "GUEST" ? owner.sessionId : null,
        status: CheckoutStatus.ACTIVE,
        email: currentUser?.email || "",
        phone: currentUser?.phone || null,
        subtotalPaise: cartView.subtotalPaise,
        taxAmountPaise: 0,
        totalAmountPaise: cartView.totalPaise,
        expiresAt,
      },
      include: {
        shippingAddress: true,
        billingAddress: true,
      },
    });
  }

  return recalculateCheckoutSession(checkoutSession.id, cookieStore, currentUser);
}

/**
 * Retrieves and recalculates checkout session with full authoritative pricing and shipping.
 */
export async function getCheckoutSession(
  checkoutId: string,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<CheckoutSessionSnapshot> {
  return recalculateCheckoutSession(checkoutId, customStore, customUser);
}

/**
 * Single authoritative checkout recalculation function.
 * Verifies cart lines, re-checks coupon eligibility, re-evaluates shipping rules,
 * and updates checkout database snapshots.
 */
export async function recalculateCheckoutSession(
  checkoutId: string,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<CheckoutSessionSnapshot> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();
  const owner = await resolveCartOwner(cookieStore, currentUser);

  const session = await prisma.checkoutSession.findUnique({
    where: { id: checkoutId },
    include: {
      shippingAddress: true,
      billingAddress: true,
      cart: {
        include: {
          items: true,
          coupon: true,
        },
      },
    },
  });

  if (!session) {
    throw new NotFoundError("Checkout session not found.");
  }

  // Verify ownership
  if (owner.type === "CUSTOMER" && session.customerId !== owner.customerId) {
    throw new UnauthorizedError("Unauthorized access to checkout session.");
  }

  if (owner.type === "GUEST" && session.sessionId !== owner.sessionId) {
    throw new UnauthorizedError("Unauthorized access to checkout session.");
  }

  // Handle session expiration
  if (session.status === CheckoutStatus.EXPIRED || new Date() > session.expiresAt) {
    if (session.status !== CheckoutStatus.EXPIRED) {
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { status: CheckoutStatus.EXPIRED },
      });
    }
    throw new ValidationError("This checkout session has expired. Please restart checkout.");
  }

  // Fresh authoritative cart pricing
  const freshCart = await getCartWithFreshPricing(cookieStore, currentUser);
  const activeShippingRules = await getActiveShippingRules();

  // Load coupon from fresh cart
  const couponData: CouponData | null = session.cart.coupon
    ? {
        id: session.cart.coupon.id,
        code: session.cart.coupon.code,
        discountType: session.cart.coupon.discountType,
        discountValue: session.cart.coupon.discountValue,
        minCartValuePaise: session.cart.coupon.minCartValuePaise,
        maxDiscountPaise: session.cart.coupon.maxDiscountPaise,
        startDate: session.cart.coupon.startDate,
        expiryDate: session.cart.coupon.expiryDate,
        usageLimit: session.cart.coupon.usageLimit,
        perCustomerLimit: session.cart.coupon.perCustomerLimit,
        currentUsageCount: session.cart.coupon.currentUsageCount,
        isActive: session.cart.coupon.isActive,
      }
    : null;

  // Calculate authoritative totals
  const totals = calculateCheckoutTotals({
    items: freshCart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productType: item.productType,
      hsnCode: item.hsnCode,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      totalPricePaise: item.totalPricePaise,
      isAvailable: item.isAvailable,
    })),
    coupon: couponData,
    shippingAddress: session.shippingAddress
      ? {
          postalCode: session.shippingAddress.postalCode,
          state: session.shippingAddress.state,
          city: session.shippingAddress.city,
          country: session.shippingAddress.country,
        }
      : null,
    shippingRules: activeShippingRules,
  });

  // 5. Evaluate COD Eligibility
  const codEligibility = checkCodEligibility({
    pincode: session.shippingAddress?.postalCode || null,
    totalAmountPaise: totals.totalPayablePaise,
    isDeliverable: totals.isDeliverable,
  });

  let effectivePaymentMethod = session.paymentMethod as PaymentMethod | null;
  // If paymentMethod was COD but it is no longer eligible, automatically reset it
  if (effectivePaymentMethod === "COD" && !codEligibility.eligible) {
    effectivePaymentMethod = null;
  }

  // Update snapshot in database if changed
  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: {
      subtotalPaise: totals.subtotalPaise,
      deliveryAmountPaise: totals.shippingPaise,
      deliveryOption: totals.appliedShippingRule ? totals.appliedShippingRule.name : null,
      taxAmountPaise: totals.taxAmountPaise,
      totalAmountPaise: totals.totalPayablePaise,
      paymentMethod: effectivePaymentMethod,
    },
  });

  return {
    id: session.id,
    cartId: session.cartId,
    customerId: session.customerId,
    sessionId: session.sessionId,
    status: session.status,
    email: session.email,
    phone: session.phone,
    shippingAddressId: session.shippingAddressId,
    billingAddressId: session.billingAddressId,
    shippingAddress: session.shippingAddress,
    billingAddress: session.billingAddress,
    cart: {
      id: session.cart.id,
      items: session.cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productType: item.productType,
        unitPricePaise: item.unitPricePaise,
        quantity: item.quantity,
        totalPricePaise: item.totalPricePaise,
        variantName: item.variantName,
        width: item.width,
        height: item.height,
        unit: item.unit,
      })),
      coupon: couponData,
    },
    totals,
    paymentMethod: effectivePaymentMethod,
    codEligibility,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/**
 * Updates checkout contact info (email / phone).
 */
export async function updateCheckoutContact(
  checkoutId: string,
  input: { email: string; phone?: string | null },
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<CheckoutSessionSnapshot> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();

  if (!input.email || !input.email.includes("@")) {
    throw new ValidationError("A valid email address is required.");
  }

  await prisma.checkoutSession.update({
    where: { id: checkoutId },
    data: {
      email: input.email.trim(),
      phone: input.phone ? input.phone.trim() : null,
    },
  });

  return recalculateCheckoutSession(checkoutId, cookieStore, currentUser);
}

/**
 * Selects an existing saved address for checkout shipping and/or billing.
 */
export async function selectCheckoutSavedAddress(
  checkoutId: string,
  addressId: string,
  type: "shipping" | "billing" | "both",
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<CheckoutSessionSnapshot> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();
  const owner = await resolveCartOwner(cookieStore, currentUser);

  const address = await prisma.address.findUnique({
    where: { id: addressId },
  });

  if (!address) {
    throw new NotFoundError("Selected address not found.");
  }

  if (owner.type === "CUSTOMER" && address.customerId && address.customerId !== owner.customerId) {
    throw new UnauthorizedError("Unauthorized access to this address.");
  }

  const updateData: { shippingAddressId?: string; billingAddressId?: string } = {};
  if (type === "shipping" || type === "both") {
    updateData.shippingAddressId = address.id;
  }
  if (type === "billing" || type === "both") {
    updateData.billingAddressId = address.id;
  }

  await prisma.checkoutSession.update({
    where: { id: checkoutId },
    data: updateData,
  });

  return recalculateCheckoutSession(checkoutId, cookieStore, currentUser);
}

/**
 * Sets a new address for checkout.
 */
export async function setCheckoutAddress(
  checkoutId: string,
  input: {
    shippingAddress: Partial<AddressInput>;
    billingAddress?: Partial<AddressInput> | null;
    useShippingAsBilling?: boolean;
  },
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<CheckoutSessionSnapshot> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();
  const owner = await resolveCartOwner(cookieStore, currentUser);

  const customerId = owner.type === "CUSTOMER" ? owner.customerId : null;

  // Validate shipping address
  const validatedShipping = validateAddressInput(input.shippingAddress);

  const shippingRecord = await prisma.address.create({
    data: {
      ...validatedShipping,
      customerId,
    },
  });

  let billingRecord = shippingRecord;
  if (!input.useShippingAsBilling && input.billingAddress) {
    const validatedBilling = validateAddressInput(input.billingAddress);
    billingRecord = await prisma.address.create({
      data: {
        ...validatedBilling,
        customerId,
      },
    });
  }

  await prisma.checkoutSession.update({
    where: { id: checkoutId },
    data: {
      shippingAddressId: shippingRecord.id,
      billingAddressId: billingRecord.id,
    },
  });

  return recalculateCheckoutSession(checkoutId, cookieStore, currentUser);
}

// Backward-compatible alias
export const updateCheckoutAddress = setCheckoutAddress;

export async function selectDeliveryOption(
  checkoutId: string,
  input: { deliveryOption: string },
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
) {
  return recalculateCheckoutSession(checkoutId, customStore, customUser);
}

export async function selectCheckoutPaymentMethod(
  checkoutId: string,
  paymentMethod: PaymentMethod,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<CheckoutSessionSnapshot> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();
  const owner = await resolveCartOwner(cookieStore, currentUser);

  const session = await recalculateCheckoutSession(checkoutId, cookieStore, currentUser);

  if (!session.shippingAddressId || !session.shippingAddress) {
    throw new ValidationError("Please provide a shipping address first.");
  }

  if (!session.totals.isDeliverable) {
    throw new ValidationError("Selected delivery address is not serviceable.");
  }

  if (paymentMethod === "COD") {
    const eligibility = checkCodEligibility({
      pincode: session.shippingAddress.postalCode,
      totalAmountPaise: session.totals.totalPayablePaise,
      isDeliverable: session.totals.isDeliverable,
    });

    if (!eligibility.eligible) {
      throw new ValidationError(eligibility.message);
    }
  }

  await prisma.checkoutSession.update({
    where: { id: checkoutId },
    data: {
      paymentMethod,
    },
  });

  return recalculateCheckoutSession(checkoutId, cookieStore, currentUser);
}

export async function confirmCheckout(
  checkoutId: string,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
) {
  const session = await recalculateCheckoutSession(checkoutId, customStore, customUser);
  if (!session.shippingAddressId) {
    throw new ValidationError("Shipping address is required.");
  }
  if (!session.totals.isDeliverable) {
    throw new ValidationError("Selected delivery address is not serviceable.");
  }
  return session;
}

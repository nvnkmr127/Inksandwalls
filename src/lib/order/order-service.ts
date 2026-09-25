import "server-only";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  PaymentMethod,
  PaymentStatus,
  FulfillmentStatus,
  CartStatus,
  CheckoutStatus,
} from "@prisma/client";
import { generateOrderNumber } from "./order-number";
import {
  recalculateCheckoutSession,
  type CheckoutSessionSnapshot,
} from "@/lib/checkout/checkout-service";
import {
  verifyRazorpaySignature,
} from "@/lib/payment/razorpay-service";
import { checkCodEligibility } from "@/lib/payment/cod-service";
import { generateInvoice } from "@/lib/invoice/invoice-service";
import { resolveCartOwner, type CookieStoreLike } from "@/lib/cart/cart-service";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import {
  ValidationError,
  UnauthorizedError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import type {
  PlaceRazorpayOrderInput,
  PlaceCodOrderInput,
  OrderPlacementResult,
  OrderSnapshot,
  AddressSnapshot,
} from "./types";
import { cookies } from "next/headers";

/**
 * Places a confirmed order for a verified Razorpay online payment.
 * 1. Verifies Razorpay HMAC signature.
 * 2. Recalculates authoritative checkout amounts server-side.
 * 3. Executes atomic database transaction for order, items, payment, coupon usage, and cart cleanup.
 * 4. Generates and attaches immutable GST invoice.
 * 5. Idempotent across retries/callbacks.
 */
export async function placeRazorpayOrder(
  input: PlaceRazorpayOrderInput,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<OrderPlacementResult> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();

  // 1. Idempotency Check: Check if an order already exists for this Razorpay Payment ID
  const existingOrder = await prisma.order.findUnique({
    where: { razorpayPaymentId: input.razorpayPaymentId },
    include: { items: true },
  });

  if (existingOrder) {
    logger.info("Idempotent order retrieval for existing Razorpay payment", {
      orderNumber: existingOrder.orderNumber,
      razorpayPaymentId: input.razorpayPaymentId,
    });
    return {
      success: true,
      orderNumber: existingOrder.orderNumber,
      orderId: existingOrder.id,
      paymentStatus: existingOrder.paymentStatus,
      fulfillmentStatus: existingOrder.fulfillmentStatus,
      totalPaise: existingOrder.totalPaise,
      invoiceNumber: existingOrder.invoiceNumber,
      invoiceUrl: existingOrder.invoiceUrl,
    };
  }

  // 2. Signature Verification Gate
  const isValidSignature = verifyRazorpaySignature({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  });

  if (!isValidSignature) {
    logger.warn("Razorpay payment verification failed: Invalid signature", {
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
    });
    throw new ValidationError("Payment verification failed. Invalid signature.");
  }

  // 3. Authoritative Recalculation of Checkout
  const session = await recalculateCheckoutSession(input.checkoutId, cookieStore, currentUser);

  validateCheckoutEligibility(session);

  // 4. Create Order Transactionally
  const result = await executeOrderPlacementTransaction({
    session,
    paymentMethod: PaymentMethod.RAZORPAY,
    paymentStatus: PaymentStatus.PAID,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
    idempotencyKey: input.razorpayPaymentId,
  });

  return result;
}

/**
 * Places a Cash on Delivery (COD) order.
 * 1. Validates delivery address and COD eligibility server-side.
 * 2. Recalculates authoritative checkout totals.
 * 3. Executes atomic database transaction for order, items, coupon usage, and cart cleanup.
 * 4. Generates and attaches immutable GST invoice (marked unpaid/COD).
 * 5. Idempotent across retries.
 */
export async function placeCodOrder(
  input: PlaceCodOrderInput,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<OrderPlacementResult> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();

  // 1. Authoritative Recalculation of Checkout
  const session = await recalculateCheckoutSession(input.checkoutId, cookieStore, currentUser);

  validateCheckoutEligibility(session);

  // 2. COD Gate Check
  const codEligibility = checkCodEligibility({
    pincode: session.shippingAddress?.postalCode,
    totalAmountPaise: session.totals.totalPayablePaise,
    isDeliverable: session.totals.isDeliverable,
  });

  if (!codEligibility.eligible) {
    throw new ValidationError(codEligibility.message);
  }

  const idempotencyKey = input.idempotencyKey || `cod_${session.id}_${session.cartId}`;

  // Check if COD order already placed for this session idempotency key
  const existingOrder = await prisma.order.findUnique({
    where: { idempotencyKey },
    include: { items: true },
  });

  if (existingOrder) {
    logger.info("Idempotent COD order retrieval", {
      orderNumber: existingOrder.orderNumber,
      idempotencyKey,
    });
    return {
      success: true,
      orderNumber: existingOrder.orderNumber,
      orderId: existingOrder.id,
      paymentStatus: existingOrder.paymentStatus,
      fulfillmentStatus: existingOrder.fulfillmentStatus,
      totalPaise: existingOrder.totalPaise,
      invoiceNumber: existingOrder.invoiceNumber,
      invoiceUrl: existingOrder.invoiceUrl,
    };
  }

  // 3. Create Order Transactionally
  const result = await executeOrderPlacementTransaction({
    session,
    paymentMethod: PaymentMethod.COD,
    paymentStatus: PaymentStatus.UNPAID,
    idempotencyKey,
  });

  return result;
}

/**
 * Validates checkout requirements prior to placing order.
 */
function validateCheckoutEligibility(session: CheckoutSessionSnapshot) {
  if (!session.cart.items || session.cart.items.length === 0) {
    throw new ValidationError("Cannot place order: Cart is empty.");
  }

  if (!session.shippingAddressId || !session.shippingAddress) {
    throw new ValidationError("Shipping address is required to place an order.");
  }

  if (!session.totals.isDeliverable) {
    throw new ValidationError("Delivery is not serviceable to the selected address.");
  }

  if (!session.email || !session.email.includes("@")) {
    throw new ValidationError("A valid customer email is required.");
  }

  if (session.totals.status !== "VALID") {
    throw new ValidationError("Checkout state is invalid. Please review your cart.");
  }
}

interface OrderTransactionParams {
  session: CheckoutSessionSnapshot;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  idempotencyKey: string;
}

/**
 * Core transactional order placement boundary.
 */
async function executeOrderPlacementTransaction(
  params: OrderTransactionParams
): Promise<OrderPlacementResult> {
  const {
    session,
    paymentMethod,
    paymentStatus,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    idempotencyKey,
  } = params;

  const orderNumber = generateOrderNumber();
  const customerName = `${session.shippingAddress!.firstName} ${session.shippingAddress!.lastName}`.trim();

  const shippingAddressSnapshot: AddressSnapshot = {
    firstName: session.shippingAddress!.firstName,
    lastName: session.shippingAddress!.lastName,
    addressLine1: session.shippingAddress!.addressLine1,
    addressLine2: session.shippingAddress!.addressLine2,
    city: session.shippingAddress!.city,
    state: session.shippingAddress!.state,
    postalCode: session.shippingAddress!.postalCode,
    country: session.shippingAddress!.country,
    phone: session.shippingAddress!.phone || session.phone,
  };

  const billingAddressSnapshot: AddressSnapshot = session.billingAddress
    ? {
        firstName: session.billingAddress.firstName,
        lastName: session.billingAddress.lastName,
        addressLine1: session.billingAddress.addressLine1,
        addressLine2: session.billingAddress.addressLine2,
        city: session.billingAddress.city,
        state: session.billingAddress.state,
        postalCode: session.billingAddress.postalCode,
        country: session.billingAddress.country,
        phone: session.billingAddress.phone || session.phone,
      }
    : shippingAddressSnapshot;

  // Retrieve full cart items with dimension details for immutable snapshot
  const rawCart = await prisma.cart.findUnique({
    where: { id: session.cartId },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      coupon: true,
    },
  });

  if (!rawCart || rawCart.items.length === 0) {
    throw new ValidationError("Cart not found or empty.");
  }

  // Map item tax lines proportionally
  const totalSubtotal = session.totals.subtotalPaise;
  const totalDiscount = session.totals.couponDiscountPaise || 0;

  const orderItemsData = rawCart.items.map((item) => {
    // Proportional discount allocation for line
    const itemSubtotal = item.totalPricePaise;
    const itemDiscount =
      totalSubtotal > 0
        ? Math.round((itemSubtotal / totalSubtotal) * totalDiscount)
        : 0;
    const taxableAmount = Math.max(0, itemSubtotal - itemDiscount);

    const isIntraState =
      session.shippingAddress?.state?.toLowerCase().trim() === "telangana";
    const gstRatePct = 18;
    const totalTax = Math.round((taxableAmount * gstRatePct) / 100);
    const cgst = isIntraState ? Math.round(totalTax / 2) : 0;
    const sgst = isIntraState ? totalTax - cgst : 0;
    const igst = isIntraState ? 0 : totalTax;

    return {
      productId: item.productId,
      productName: item.productName,
      productSlug: item.product.slug,
      productType: item.productType,
      variantId: item.variantId,
      variantName: item.variantName,
      sku: item.sku,
      hsnCode: item.hsnCode || item.product.hsnCode || "49119100",
      returnable: item.returnable,
      mediaKey: item.mediaKey,
      options: item.options ? (item.options as unknown as Prisma.InputJsonValue) : undefined,
      width: item.width,
      height: item.height,
      unit: item.unit,
      widthFt: item.widthFt,
      heightFt: item.heightFt,
      enteredAreaSqft: item.enteredAreaSqft,
      wastagePct: item.wastagePct,
      wastageAreaSqft: item.wastageAreaSqft,
      areaWithWastageSqft: item.areaWithWastageSqft,
      minAreaSqft: item.minAreaSqft,
      isMinAreaApplied: item.isMinAreaApplied,
      billableAreaSqft: item.billableAreaSqft,
      rollWidthFt: item.rollWidthFt,
      panelsNeeded: item.panelsNeeded,
      ratePaise: item.ratePaise,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      totalPricePaise: item.totalPricePaise,
      discountPaise: itemDiscount,
      taxableAmountPaise: taxableAmount,
      gstRatePct,
      cgstPaise: cgst,
      sgstPaise: sgst,
      igstPaise: igst,
      totalTaxPaise: totalTax,
      netTotalPaise: taxableAmount + totalTax,
    };
  });

  // Execute Database Transaction
  const createdOrder = await prisma.$transaction(async (tx) => {
    // 1. Create Order
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: session.customerId,
        guestSessionId: session.sessionId,
        customerEmail: session.email,
        customerPhone: session.phone,
        customerName,
        shippingAddress: shippingAddressSnapshot as object,
        billingAddress: billingAddressSnapshot as object,
        subtotalPaise: session.totals.subtotalPaise,
        discountPaise: session.totals.couponDiscountPaise || 0,
        shippingPaise: session.totals.shippingPaise,
        taxPaise: session.totals.taxAmountPaise,
        totalPaise: session.totals.totalPayablePaise,
        couponCode: session.cart.coupon?.code || null,
        couponSnapshot: session.cart.coupon ? (session.cart.coupon as object) : undefined,
        taxBreakdown: session.totals.taxBreakdown as object,
        shippingOption: session.totals.appliedShippingRule?.name || null,
        paymentMethod,
        paymentStatus,
        fulfillmentStatus: FulfillmentStatus.CONFIRMED,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        idempotencyKey,
        items: {
          create: orderItemsData,
        },
        payments: {
          create: {
            provider: paymentMethod === PaymentMethod.RAZORPAY ? "RAZORPAY" : "COD",
            providerPaymentId: razorpayPaymentId || `cod_pay_${orderNumber}`,
            providerOrderId: razorpayOrderId || `cod_ord_${orderNumber}`,
            providerSignature: razorpaySignature,
            amountPaise: session.totals.totalPayablePaise,
            currency: "INR",
            status: paymentStatus,
            metadata: {
              checkoutSessionId: session.id,
              cartId: session.cartId,
            },
          },
        },
      },
      include: {
        items: true,
      },
    });

    // 2. Record Coupon Usage if coupon was applied
    if (session.cart.coupon) {
      await tx.couponUsage.create({
        data: {
          couponId: session.cart.coupon.id,
          customerId: session.customerId,
          cartId: session.cartId,
        },
      });

      await tx.coupon.update({
        where: { id: session.cart.coupon.id },
        data: {
          currentUsageCount: { increment: 1 },
        },
      });
    }

    // 3. Convert and Cleanup Cart
    await tx.cart.update({
      where: { id: session.cartId },
      data: {
        status: CartStatus.CONVERTED,
        couponId: null,
      },
    });

    await tx.cartItem.deleteMany({
      where: { cartId: session.cartId },
    });

    // 4. Mark Checkout Session Completed
    await tx.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: CheckoutStatus.COMPLETED,
      },
    });

    return order;
  });

  // Step 6: Generate GST Invoice Asynchronously / Post-Commit
  let invoiceNumber: string | null = null;
  let invoiceUrl: string | null = null;
  try {
    const invNumber = `INV-${orderNumber.replace("INW-", "")}`;
    const invoiceResult = await generateInvoice({
      invoiceNumber: invNumber,
      customer: {
        name: customerName,
        email: session.email,
        phone: session.phone || undefined,
      },
      billingAddress: {
        firstName: billingAddressSnapshot.firstName,
        lastName: billingAddressSnapshot.lastName,
        addressLine1: billingAddressSnapshot.addressLine1,
        addressLine2: billingAddressSnapshot.addressLine2 || undefined,
        city: billingAddressSnapshot.city,
        state: billingAddressSnapshot.state,
        postalCode: billingAddressSnapshot.postalCode,
        country: billingAddressSnapshot.country,
        phone: billingAddressSnapshot.phone || undefined,
      },
      shippingAddress: {
        firstName: shippingAddressSnapshot.firstName,
        lastName: shippingAddressSnapshot.lastName,
        addressLine1: shippingAddressSnapshot.addressLine1,
        addressLine2: shippingAddressSnapshot.addressLine2 || undefined,
        city: shippingAddressSnapshot.city,
        state: shippingAddressSnapshot.state,
        postalCode: shippingAddressSnapshot.postalCode,
        country: shippingAddressSnapshot.country,
        phone: shippingAddressSnapshot.phone || undefined,
      },
      lines: orderItemsData.map((item, idx) => ({
        id: `line_${idx + 1}`,
        productId: item.productId || "",
        productName: item.productName,
        hsnCode: item.hsnCode,
        productType: item.productType,
        variantName: item.variantName,
        dimensions: {
          width: item.width || undefined,
          height: item.height || undefined,
          unit: item.unit || undefined,
          areaSqft: item.billableAreaSqft || item.enteredAreaSqft || undefined,
        },
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        totalPricePaise: item.totalPricePaise,
      })),
      discountPaise: session.totals.couponDiscountPaise || 0,
      shippingPaise: session.totals.shippingPaise,
      payment: {
        method: paymentMethod,
        transactionId: razorpayPaymentId || `COD-${orderNumber}`,
        status: paymentStatus === PaymentStatus.PAID ? "PAID" : "PENDING",
        paidAt: paymentStatus === PaymentStatus.PAID ? new Date().toISOString() : undefined,
      },
    });

    if (invoiceResult.success) {
      invoiceNumber = invoiceResult.invoiceNumber;
      invoiceUrl = invoiceResult.r2Url;

      await prisma.order.update({
        where: { id: createdOrder.id },
        data: {
          invoiceNumber: invoiceResult.invoiceNumber,
          invoiceUrl: invoiceResult.r2Url,
          invoiceR2Key: invoiceResult.r2Key,
          invoiceGeneratedAt: new Date(),
        },
      });
    }
  } catch (invoiceErr) {
    logger.error("Invoice generation after order placement encountered error", {
      orderNumber,
    }, invoiceErr as Error);
    // Note: Order remains safely persisted; invoice can be regenerated if needed.
  }

  try {
    const { sendOrderConfirmationEmail } = await import("@/lib/email/email-service");
    await sendOrderConfirmationEmail({
      orderNumber: createdOrder.orderNumber,
      customerName,
      customerEmail: session.email,
      createdAt: createdOrder.createdAt,
      totalPaise: createdOrder.totalPaise,
      invoiceUrl,
      items: orderItemsData,
    });
  } catch (emailErr) {
    logger.error("Failed to send order confirmation email", {
      orderNumber,
      component: "OrderService",
    }, emailErr as Error);
  }

  try {
    if (session.phone) {
      const { queueWabaNotification } = await import("@/lib/queue/waba-queue");
      await queueWabaNotification(`order_conf_${createdOrder.id}`, {
        type: "ORDER_CONFIRMED",
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        phone: session.phone,
      });
    }
  } catch (qErr) {
    logger.error("Failed to queue WABA order confirmation", {
      orderNumber,
      component: "OrderService",
    }, qErr as Error);
  }

  logger.info("Order successfully placed and committed", {
    orderNumber,
    totalPaise: createdOrder.totalPaise,
    paymentMethod,
    paymentStatus,
  });

  return {
    success: true,
    orderNumber: createdOrder.orderNumber,
    orderId: createdOrder.id,
    paymentStatus: createdOrder.paymentStatus,
    fulfillmentStatus: createdOrder.fulfillmentStatus,
    totalPaise: createdOrder.totalPaise,
    invoiceNumber,
    invoiceUrl,
  };
}

/**
 * Retrieves an order snapshot by public order number.
 */
export async function getOrderByNumber(
  orderNumber: string,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<OrderSnapshot | null> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();
  const owner = await resolveCartOwner(cookieStore, currentUser);

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
    },
  });

  if (!order) {
    return null;
  }

  // Authorization / IDOR Protection
  if (currentUser?.role !== "STORE_ADMIN" && currentUser?.role !== "SUPER_ADMIN") {
    if (order.customerId && owner.type === "CUSTOMER" && order.customerId !== owner.customerId) {
      throw new UnauthorizedError("Unauthorized access to order.");
    }
    if (order.guestSessionId && owner.type === "GUEST" && order.guestSessionId !== owner.sessionId) {
      throw new UnauthorizedError("Unauthorized access to order.");
    }
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    guestSessionId: order.guestSessionId,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    shippingAddress: order.shippingAddress as unknown as AddressSnapshot,
    billingAddress: order.billingAddress as unknown as AddressSnapshot,
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    shippingPaise: order.shippingPaise,
    taxPaise: order.taxPaise,
    totalPaise: order.totalPaise,
    couponCode: order.couponCode,
    couponSnapshot: order.couponSnapshot as unknown as OrderSnapshot["couponSnapshot"],
    taxBreakdown: order.taxBreakdown as unknown as OrderSnapshot["taxBreakdown"],
    shippingOption: order.shippingOption,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,
    invoiceNumber: order.invoiceNumber,
    invoiceUrl: order.invoiceUrl,
    invoiceR2Key: order.invoiceR2Key,
    invoiceGeneratedAt: order.invoiceGeneratedAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      productType: item.productType,
      variantId: item.variantId,
      variantName: item.variantName,
      sku: item.sku,
      hsnCode: item.hsnCode,
      returnable: item.returnable,
      mediaKey: item.mediaKey,
      options: item.options as Record<string, unknown> | null,
      width: item.width,
      height: item.height,
      unit: item.unit,
      widthFt: item.widthFt,
      heightFt: item.heightFt,
      enteredAreaSqft: item.enteredAreaSqft,
      wastagePct: item.wastagePct,
      wastageAreaSqft: item.wastageAreaSqft,
      areaWithWastageSqft: item.areaWithWastageSqft,
      minAreaSqft: item.minAreaSqft,
      isMinAreaApplied: item.isMinAreaApplied,
      billableAreaSqft: item.billableAreaSqft,
      rollWidthFt: item.rollWidthFt,
      panelsNeeded: item.panelsNeeded,
      ratePaise: item.ratePaise,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      totalPricePaise: item.totalPricePaise,
      discountPaise: item.discountPaise,
      taxableAmountPaise: item.taxableAmountPaise,
      gstRatePct: item.gstRatePct,
      cgstPaise: item.cgstPaise,
      sgstPaise: item.sgstPaise,
      igstPaise: item.igstPaise,
      totalTaxPaise: item.totalTaxPaise,
      netTotalPaise: item.netTotalPaise,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

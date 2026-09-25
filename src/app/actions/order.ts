"use server";

import { revalidatePath } from "next/cache";
import {
  placeRazorpayOrder,
  placeCodOrder,
  getOrderByNumber,
} from "@/lib/order/order-service";
import { createRazorpayOrder } from "@/lib/payment/razorpay-service";
import { recalculateCheckoutSession } from "@/lib/checkout/checkout-service";
import { addItemToCart } from "@/lib/cart/cart-service";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getCustomerOrderByNumber } from "@/lib/order/order-list-service";
import type {
  PlaceRazorpayOrderInput,
  PlaceCodOrderInput,
  OrderPlacementResult,
  OrderSnapshot,
} from "@/lib/order/types";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/errors";

export async function createRazorpayOrderForCheckoutAction(
  checkoutId: string
): Promise<{
  success: boolean;
  orderId?: string;
  amountPaise?: number;
  currency?: string;
  keyId?: string;
  error?: string;
}> {
  try {
    const session = await recalculateCheckoutSession(checkoutId);
    if (!session.shippingAddressId) {
      return { success: false, error: "Please select a shipping address first." };
    }
    if (!session.totals.isDeliverable) {
      return { success: false, error: "Delivery address is not serviceable." };
    }

    const razorpayOrder = await createRazorpayOrder(
      session.totals.totalPayablePaise,
      session.id
    );

    return {
      success: true,
      orderId: razorpayOrder.orderId,
      amountPaise: razorpayOrder.amountPaise,
      currency: razorpayOrder.currency,
      keyId: razorpayOrder.keyId,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function placeRazorpayOrderAction(
  input: PlaceRazorpayOrderInput
): Promise<OrderPlacementResult> {
  try {
    const result = await placeRazorpayOrder(input);
    revalidatePath("/cart");
    revalidatePath(`/checkout/${input.checkoutId}`);
    return result;
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError
    ) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: (error as Error).message || "Failed to place order. Please try again.",
    };
  }
}

export async function placeCodOrderAction(
  input: PlaceCodOrderInput
): Promise<OrderPlacementResult> {
  try {
    const result = await placeCodOrder(input);
    revalidatePath("/cart");
    revalidatePath(`/checkout/${input.checkoutId}`);
    return result;
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError
    ) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: (error as Error).message || "Failed to place Cash on Delivery order.",
    };
  }
}

export async function getOrderDetailsAction(
  orderNumber: string
): Promise<{
  success: boolean;
  order?: OrderSnapshot | null;
  error?: string;
}> {
  try {
    const order = await getOrderByNumber(orderNumber);
    if (!order) {
      return { success: false, error: "Order not found." };
    }
    return { success: true, order };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function reorderOrderAction(
  orderNumber: string
): Promise<{ success: boolean; error?: string; cartId?: string }> {
  try {
    const user = await requireAuth();
    const order = await getCustomerOrderByNumber(orderNumber);
    if (!order) {
      throw new Error("Order not found");
    }

    let lastCartId = null;
    for (const item of order.items) {
      if (!item.productId) continue;
      
      const cart = await addItemToCart({
        productId: item.productId,
        productType: item.productType as "PER_AREA" | "FIXED",
        quantity: item.quantity,
        width: item.width || undefined,
        height: item.height || undefined,
        unit: item.unit as "inch" | "ft" | "cm" | "mm" | undefined,
        variantId: item.variantId,
        options: item.options ? (item.options as Record<string, unknown>) : undefined,
      });
      lastCartId = cart.cartId;
    }

    return { success: true, cartId: lastCartId || undefined };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

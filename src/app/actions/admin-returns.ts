"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { transitionOrderFulfillment } from "@/lib/order/fulfillment-service";
import { checkReturnEligibility } from "@/lib/order/return-service";
import { getAdminOrderDetail } from "@/lib/order/admin-order-detail-service";
import { FulfillmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function requestReturnAction(orderId: string) {
  try {
    await requireAdmin();

    const order = await getAdminOrderDetail(orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const eligibility = checkReturnEligibility(order, order.items);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason || "Not eligible for return" };
    }

    await transitionOrderFulfillment(orderId, FulfillmentStatus.RETURN_REQUESTED);

    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to request return";
    console.error("Failed to request return", error);
    return { success: false, error: message };
  }
}

export async function completeReturnAction(orderId: string) {
  try {
    await requireAdmin();

    const order = await getAdminOrderDetail(orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.fulfillmentStatus !== FulfillmentStatus.RETURN_REQUESTED) {
      return { success: false, error: "Order is not in RETURN_REQUESTED state" };
    }

    await transitionOrderFulfillment(orderId, FulfillmentStatus.RETURNED);

    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete return";
    console.error("Failed to complete return", error);
    return { success: false, error: message };
  }
}

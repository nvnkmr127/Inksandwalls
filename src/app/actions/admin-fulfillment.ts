"use server";

import { FulfillmentStatus } from "@prisma/client";
import { transitionOrderFulfillment } from "@/lib/order/fulfillment-service";
import { revalidatePath } from "next/cache";

export async function updateOrderFulfillmentAction(orderId: string, nextStatus: FulfillmentStatus) {
  try {
    const updatedOrder = await transitionOrderFulfillment(orderId, nextStatus);
    
    // Revalidate the order detail page and the list page
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");

    return { success: true, fulfillmentStatus: updatedOrder.fulfillmentStatus };
  } catch (error: any) {
    console.error("Fulfillment transition failed", error);
    return { success: false, error: error.message || "Failed to update status" };
  }
}

"use server";

import { processRazorpayRefund } from "@/lib/payment/refund-service";
import { revalidatePath } from "next/cache";

export async function processRefundAction(orderId: string, amountPaise: number) {
  try {
    const refund = await processRazorpayRefund(orderId, amountPaise);
    
    // Revalidate the order detail page to reflect the new refund
    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true, refund };
  } catch (error: any) {
    console.error("Refund failed", error);
    return { success: false, error: error.message || "Failed to process refund" };
  }
}

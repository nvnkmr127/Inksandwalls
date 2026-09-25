import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { FulfillmentStatus, Prisma } from "@prisma/client";
import { isValidFulfillmentTransition, isTerminalFulfillmentStatus } from "./status";
import { recordAuditEvent } from "@/lib/audit/audit";
import { headers } from "next/headers";

export async function transitionOrderFulfillment(
  orderId: string,
  targetStatus: FulfillmentStatus
) {
  const admin = await requireAdmin();

  // Load the current order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, fulfillmentStatus: true, orderNumber: true, customerName: true, customerEmail: true, customerPhone: true },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const currentStatus = order.fulfillmentStatus;

  // Validate the transition
  if (!isValidFulfillmentTransition(currentStatus, targetStatus)) {
    throw new Error(`Invalid transition from ${currentStatus} to ${targetStatus}`);
  }

  if (isTerminalFulfillmentStatus(currentStatus)) {
    throw new Error(`Order is already in a terminal state: ${currentStatus}`);
  }

  const updateData: Prisma.OrderUpdateInput = {
    fulfillmentStatus: targetStatus,
  };

  // Timestamps
  if (targetStatus === FulfillmentStatus.SHIPPED) {
    updateData.shippedAt = new Date();
  } else if (targetStatus === FulfillmentStatus.DELIVERED) {
    updateData.deliveredAt = new Date();
  } else if (targetStatus === FulfillmentStatus.CANCELLED) {
    updateData.cancelledAt = new Date();
  }

  // Transaction for concurrency protection and audit logging
  const updatedOrder = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: {
        id: orderId,
        fulfillmentStatus: currentStatus, // concurrency guard
      },
      data: updateData,
    });

    // Extract headers for audit IP/UA if available
    let ipAddress = null;
    let userAgent = null;
    try {
      const h = await headers();
      ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
      userAgent = h.get("user-agent")?.slice(0, 512) || null;
    } catch {
      // Ignore if headers aren't available in this context
    }

    await recordAuditEvent(
      {
        actorUserId: admin.id,
        action: "UPDATE_FULFILLMENT_STATUS",
        resourceType: "ORDER",
        resourceId: order.id,
        ipAddress,
        userAgent,
        metadata: {
          previousStatus: currentStatus,
          newStatus: targetStatus,
        },
      },
      tx
    );

    return updated;
  });

  try {
    if (targetStatus === FulfillmentStatus.SHIPPED || targetStatus === FulfillmentStatus.DELIVERED) {
      const { sendShippingEmail, sendDeliveryEmail } = await import("@/lib/email/email-service");
      if (targetStatus === FulfillmentStatus.SHIPPED) {
        await sendShippingEmail({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          courierName: updatedOrder.courierName,
          awb: updatedOrder.awb,
          trackingUrl: updatedOrder.trackingUrl,
        });
      } else if (targetStatus === FulfillmentStatus.DELIVERED) {
        await sendDeliveryEmail({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
        });
      }
    }
  } catch (emailErr) {
    console.error("Failed to send fulfillment email", emailErr);
  }

  try {
    if (order.customerPhone) {
      const { queueWabaNotification } = await import("@/lib/queue/waba-queue");
      if (targetStatus === FulfillmentStatus.IN_PRODUCTION) {
        await queueWabaNotification(`waba_inprod_${order.id}`, {
          type: "IN_PRODUCTION",
          orderId: order.id,
          orderNumber: order.orderNumber,
          phone: order.customerPhone,
        });
      } else if (targetStatus === FulfillmentStatus.SHIPPED) {
        await queueWabaNotification(`waba_shipped_${order.id}`, {
          type: "SHIPPED",
          orderId: order.id,
          orderNumber: order.orderNumber,
          phone: order.customerPhone,
          metadata: {
            courierName: updatedOrder.courierName,
            awb: updatedOrder.awb,
          }
        });
      } else if (targetStatus === FulfillmentStatus.DELIVERED) {
        await queueWabaNotification(`waba_delivered_${order.id}`, {
          type: "DELIVERED",
          orderId: order.id,
          orderNumber: order.orderNumber,
          phone: order.customerPhone,
        });
        
        // Queue review request as well
        await queueWabaNotification(`waba_review_${order.id}`, {
          type: "REVIEW_REQUEST",
          orderId: order.id,
          orderNumber: order.orderNumber,
          phone: order.customerPhone,
        });
      }
    }
  } catch (qErr) {
    console.error("Failed to queue WABA fulfillment notification", qErr);
  }

  return updatedOrder;
}

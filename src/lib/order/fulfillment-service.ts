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
    select: { id: true, fulfillmentStatus: true },
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

  return updatedOrder;
}

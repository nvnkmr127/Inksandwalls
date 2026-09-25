import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { PaymentStatus, RefundStatus } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/audit";
import { headers } from "next/headers";
import { issueRazorpayRefund } from "./razorpay-service";
import { logger } from "@/lib/logger";

export async function processRazorpayRefund(orderId: string, amountPaise: number) {
  const admin = await requireAdmin();

  // Load the order and its successful Razorpay payment
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: {
        where: {
          provider: "RAZORPAY",
          status: PaymentStatus.PAID,
        },
      },
      refunds: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const payment = order.payments[0];
  if (!payment) {
    throw new Error("No successful Razorpay payment found for this order");
  }

  if (!payment.providerPaymentId) {
    throw new Error("Missing Razorpay payment ID");
  }

  if (amountPaise <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }

  const alreadyRefundedPaise = order.refunds
    .filter((r) => r.status !== RefundStatus.FAILED)
    .reduce((sum, r) => sum + r.amountPaise, 0);

  const refundablePaise = payment.amountPaise - alreadyRefundedPaise;

  if (amountPaise > refundablePaise) {
    throw new Error(`Refund amount exceeds remaining refundable amount (${refundablePaise})`);
  }

  // Idempotency: Create refund record in INITIATED state locally first
  const localRefund = await prisma.refund.create({
    data: {
      orderId: order.id,
      paymentId: payment.id,
      amountPaise,
      status: RefundStatus.INITIATED,
      initiatedByUserId: admin.id,
    },
  });

  let ipAddress = null;
  let userAgent = null;
  try {
    const h = await headers();
    ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    userAgent = h.get("user-agent")?.slice(0, 512) || null;
  } catch {
    // ignore
  }

  try {
    // Make Razorpay API Call
    const razorpayResponse = await issueRazorpayRefund(payment.providerPaymentId, amountPaise, {
      orderId: order.orderNumber,
    });

    const isSuccess = razorpayResponse?.status === "processed";

    // Update local state with Razorpay response
    const completedRefund = await prisma.$transaction(async (tx) => {
      const updatedRefund = await tx.refund.update({
        where: { id: localRefund.id },
        data: {
          providerRefundId: razorpayResponse?.id,
          status: isSuccess ? RefundStatus.PROCESSED : RefundStatus.FAILED,
        },
      });

      // Audit Log
      await recordAuditEvent(
        {
          actorUserId: admin.id,
          action: "PROCESS_RAZORPAY_REFUND",
          resourceType: "ORDER",
          resourceId: order.id,
          ipAddress,
          userAgent,
          metadata: {
            paymentId: payment.id,
            razorpayPaymentId: payment.providerPaymentId,
            refundId: updatedRefund.id,
            razorpayRefundId: updatedRefund.providerRefundId,
            amountPaise,
            status: updatedRefund.status,
          },
        },
        tx
      );

      return updatedRefund;
    });

    if (!isSuccess) {
      throw new Error(`Refund failed on provider side. Status: ${razorpayResponse?.status}`);
    }

    return completedRefund;
  } catch (error: any) {
    logger.error("Refund flow failed", { refundId: localRefund.id }, error);

    // Record failure if we threw
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: localRefund.id },
        data: { status: RefundStatus.FAILED },
      });

      await recordAuditEvent(
        {
          actorUserId: admin.id,
          action: "PROCESS_RAZORPAY_REFUND_FAILED",
          resourceType: "ORDER",
          resourceId: order.id,
          ipAddress,
          userAgent,
          metadata: {
            paymentId: payment.id,
            amountPaise,
            error: error.message,
          },
        },
        tx
      );
    });

    throw error;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/payment/razorpay-service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing x-razorpay-signature header" },
        { status: 400 }
      );
    }

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn("Razorpay webhook invalid signature received");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    logger.info("Razorpay webhook event received", { event });

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload.payload?.payment?.entity;
      const razorpayPaymentId = paymentEntity?.id;
      const razorpayOrderId = paymentEntity?.order_id;

      if (razorpayPaymentId) {
        const existingOrder = await prisma.order.findUnique({
          where: { razorpayPaymentId },
        });

        if (existingOrder) {
          logger.info("Razorpay webhook: Order already confirmed", {
            orderNumber: existingOrder.orderNumber,
            razorpayPaymentId,
          });
        } else {
          logger.info("Razorpay webhook: Payment captured, awaiting client commit or background sync", {
            razorpayPaymentId,
            razorpayOrderId,
          });
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    logger.error("Razorpay webhook processing error", {}, error as Error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

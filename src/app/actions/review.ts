"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  content: z.string().max(1000).optional(),
});

export async function submitReview(data: z.infer<typeof reviewSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { productId, rating, content } = reviewSchema.parse(data);

    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
    });

    if (!customer) {
      return { success: false, error: "Customer profile not found" };
    }

    // Verify purchase eligibility
    const eligibleOrder = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          customerId: customer.id,
          fulfillmentStatus: "DELIVERED",
        },
      },
    });

    if (!eligibleOrder) {
      return {
        success: false,
        error: "You can only review products that have been delivered to you.",
      };
    }

    // Check for existing review
    const existingReview = await prisma.review.findUnique({
      where: {
        customerId_productId: {
          customerId: customer.id,
          productId,
        },
      },
    });

    if (existingReview) {
      return {
        success: false,
        error: "You have already reviewed this product.",
      };
    }

    // Create review (defaults to PENDING status)
    await prisma.review.create({
      data: {
        rating,
        content: content || null,
        customerId: customer.id,
        productId,
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "REVIEW_SUBMITTED",
        resourceType: "Review",
        resourceId: productId,
        actorUserId: session.user.id,
        metadata: { rating },
      },
    });

    return { success: true };
  } catch (error) {
    logger.error("Error submitting review", { error });
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid data submitted" };
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

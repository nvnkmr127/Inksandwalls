"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

const updateReviewStatusSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

export async function updateReviewStatus(data: z.infer<typeof updateReviewStatusSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "STORE_ADMIN" && session.user.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized" };
    }

    const { reviewId, status } = updateReviewStatusSchema.parse(data);

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        action: "REVIEW_STATUS_UPDATED",
        resourceType: "Review",
        resourceId: review.id,
        actorUserId: session.user.id,
        metadata: { status },
      },
    });

    revalidatePath("/admin/reviews");
    revalidatePath(`/products/${review.productId}`);

    return { success: true };
  } catch (error) {
    logger.error("Error updating review status", { error });
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid data submitted" };
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

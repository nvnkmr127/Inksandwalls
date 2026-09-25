"use server";

import { createEnquirySchema, CreateEnquiryInput } from "@/lib/enquiry/types";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/correlation";

export async function submitEnquiry(data: CreateEnquiryInput) {
  const correlationId = getCorrelationId();
  
  try {
    const validated = createEnquirySchema.parse(data);
    const user = await getCurrentUser();
    
    // Find customer ID if logged in
    let customerId = undefined;
    if (user?.id) {
      const customer = await prisma.customer.findUnique({
        where: { userId: user.id }
      });
      if (customer) {
        customerId = customer.id;
      }
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        name: validated.name.trim(),
        phone: validated.phone.trim(),
        message: validated.message?.trim(),
        source: validated.source?.trim() || "web",
        customerId,
      }
    });

    // Simulate notification mechanism via logger
    logger.info("Notification: New Consultation Enquiry Received", {
      correlationId,
      component: "EnquiryService",
      metadata: {
        enquiryId: enquiry.id,
        name: enquiry.name,
        phone: enquiry.phone,
      }
    });

    try {
      const { sendConsultationEnquiryEmail } = await import("@/lib/email/email-service");
      await sendConsultationEnquiryEmail(enquiry);
    } catch (emailErr) {
      logger.error("Failed to send consultation email", { correlationId, component: "EnquiryService" }, emailErr as Error);
    }

    return { success: true, enquiryId: enquiry.id };
  } catch (error) {
    logger.error("Failed to submit enquiry", { correlationId, component: "EnquiryService" }, error as Error);
    return { success: false, error: "Failed to submit enquiry. Please try again." };
  }
}

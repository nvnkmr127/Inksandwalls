import { Resend } from "resend";
import { logger } from "@/lib/logger";
import {
  getOrderConfirmationTemplate,
  getShippingTemplate,
  getDeliveryTemplate,
  getConsultationEnquiryTemplate,
} from "./templates";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const defaultSender = process.env.EMAIL_SENDER || "INKs & Walls <onboarding@resend.dev>";
const storeEmail = "support@inksandwalls.com"; // used as a fallback for internal emails

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendTransactionalEmail(options: EmailOptions) {
  if (!resendApiKey && process.env.NODE_ENV === "production") {
    logger.error("Missing RESEND_API_KEY in production.");
    throw new Error("Missing RESEND_API_KEY in production.");
  }

  if (!resendApiKey) {
    logger.info("Skipping email delivery (no API key)", { subject: options.subject, to: options.to });
    return { success: true, mock: true };
  }

  try {
    const { data, error } = await resend!.emails.send({
      from: options.from || defaultSender,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      logger.error("Resend API error", { component: "EmailService", error });
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    logger.error("Failed to send transactional email", { component: "EmailService", error });
    return { success: false, error };
  }
}

export async function sendOrderConfirmationEmail(order: any) {
  if (!order.customerEmail) return { success: false, error: "No customer email provided" };
  
  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `Order Confirmation - ${order.orderNumber}`,
    html: getOrderConfirmationTemplate(order),
  });
}

export async function sendShippingEmail(order: any) {
  if (!order.customerEmail) return { success: false, error: "No customer email provided" };
  
  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `Your order ${order.orderNumber} has been shipped`,
    html: getShippingTemplate(order),
  });
}

export async function sendDeliveryEmail(order: any) {
  if (!order.customerEmail) return { success: false, error: "No customer email provided" };
  
  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `Your order ${order.orderNumber} has been delivered`,
    html: getDeliveryTemplate(order),
  });
}

export async function sendConsultationEnquiryEmail(enquiry: any) {
  // Send to store admin
  return sendTransactionalEmail({
    to: storeEmail,
    subject: `New Consultation Enquiry: ${enquiry.name}`,
    html: getConsultationEnquiryTemplate(enquiry),
  });
}

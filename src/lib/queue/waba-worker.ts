import { Worker, Job } from "bullmq";
import { connection } from "./redis";
import { WABA_NOTIFICATION_QUEUE, WabaNotificationJobData } from "./waba-queue";
import { getWhatsAppProvider } from "@/lib/whatsapp/watxio";
import { logger } from "@/lib/logger";

const provider = getWhatsAppProvider();

// Helper to safely format phone
function normalizePhone(phone: string) {
  // Use existing normalization if available, else simple fallback
  return phone.replace(/\D/g, "");
}

async function processJob(job: Job<WabaNotificationJobData>) {
  const { type, orderNumber, phone, metadata } = job.data;
  
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    logger.warn(`Invalid phone number for WABA notification`, { component: "WabaWorker", metadata: { orderNumber } });
    return;
  }

  logger.info(`Processing WABA notification: ${type}`, { component: "WabaWorker", metadata: { orderNumber } });

  let templateName = "";
  let parameters: string[] = [];

  switch (type) {
    case "ORDER_CONFIRMED":
      templateName = "order_confirmed";
      parameters = [orderNumber];
      break;
    case "IN_PRODUCTION":
      templateName = "in_production";
      parameters = [orderNumber];
      break;
    case "SHIPPED":
      templateName = "order_shipped";
      parameters = [
        orderNumber, 
        metadata?.courierName || "Standard Shipping", 
        metadata?.awb || "N/A"
      ];
      break;
    case "DELIVERED":
      templateName = "order_delivered";
      parameters = [orderNumber];
      break;
    case "REVIEW_REQUEST":
      templateName = "review_request";
      // Point them to their orders page
      parameters = [orderNumber];
      break;
    default:
      logger.error(`Unknown WABA notification type: ${type}`, { component: "WabaWorker", metadata: { orderNumber } });
      return;
  }

  const result = await provider.sendTemplate({
    phone: normalizedPhone,
    templateName,
    parameters
  });

  if (!result.success) {
    throw new Error(`Failed to send WABA template ${templateName}: ${result.error}`);
  }
}

export const testProcessJob = processJob;

export const wabaWorker = process.env.NODE_ENV === "test" 
  ? (null as unknown as Worker<WabaNotificationJobData>)
  : new Worker<WabaNotificationJobData>(
      WABA_NOTIFICATION_QUEUE,
      processJob,
      { connection }
    );

if (wabaWorker) {
  wabaWorker.on("completed", (job) => {
    logger.info(`WABA notification job completed`, { component: "WabaWorker", metadata: { jobId: job.id } });
  });

  wabaWorker.on("failed", (job, err) => {
    logger.error(`WABA notification job failed`, { component: "WabaWorker", metadata: { jobId: job?.id } }, err);
  });
}

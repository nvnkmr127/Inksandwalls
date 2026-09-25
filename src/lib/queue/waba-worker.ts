import { Worker, Job } from "bullmq";
import { connection } from "./redis";
import { WABA_NOTIFICATION_QUEUE, WabaNotificationJobData } from "./waba-queue";
import { getWhatsAppProvider } from "@/lib/whatsapp/watxio";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { UnrecoverableError } from "bullmq";

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
        (metadata?.courierName as string) || "Standard Shipping", 
        (metadata?.awb as string) || "N/A"
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
    if (result.error?.toLowerCase().includes("configuration") || result.error?.toLowerCase().includes("invalid")) {
      logger.error(`Permanent failure sending WABA template ${templateName}`, { 
        component: "WabaWorker", 
        metadata: { orderNumber, error: result.error, isFinal: true } 
      });
      throw new UnrecoverableError(`Permanent failure: ${result.error}`);
    }
    
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
    logger.info(`WABA notification job completed`, { component: "WabaWorker", metadata: { jobId: job.id, type: job.name } });
  });

  wabaWorker.on("failed", (job, err) => {
    const isFinal = !job || job.attemptsMade >= job.opts.attempts!;
    logger.error(`WABA notification job failed (Attempt ${job?.attemptsMade || 1})`, { 
      component: "WabaWorker", 
      metadata: { 
        jobId: job?.id, 
        type: job?.name,
        isFinal,
        errorMsg: err.message
      } 
    });
    
    if (isFinal) {
      Sentry.captureException(err, {
        tags: { type: "waba_notification", final_failure: true },
        extra: { jobId: job?.id, payload: job?.data }
      });
    }
  });
}

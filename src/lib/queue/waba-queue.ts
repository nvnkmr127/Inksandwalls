import { Queue } from "bullmq";
import { connection } from "./redis";
import { logger } from "@/lib/logger";

export const WABA_NOTIFICATION_QUEUE = "waba-notifications";

export interface WabaNotificationJobData {
  type: "ORDER_CONFIRMED" | "IN_PRODUCTION" | "SHIPPED" | "DELIVERED" | "REVIEW_REQUEST";
  orderId: string;
  orderNumber: string;
  phone: string;
  metadata?: Record<string, unknown>;
}

export const wabaQueue = process.env.NODE_ENV === "test"
  ? (null as unknown as Queue<WabaNotificationJobData>)
  : new Queue<WabaNotificationJobData>(WABA_NOTIFICATION_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100, // Keep last 100 failed jobs
      },
    });

const testAddedJobs = new Set<string>();

export async function queueWabaNotification(
  jobId: string,
  data: WabaNotificationJobData
) {
  try {
    if (process.env.NODE_ENV === "test") {
      if (testAddedJobs.has(jobId)) {
        return; // Idempotency
      }
      testAddedJobs.add(jobId);
      
      const { testProcessJob } = await import("./waba-worker");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await testProcessJob({ data, id: jobId } as any);
      return;
    }

    await wabaQueue.add(data.type, data, {
      jobId, // Idempotency
    });
    logger.info(`Queued WABA notification: ${data.type}`, {
      component: "WabaQueue",
      metadata: { orderNumber: data.orderNumber, jobId },
    });
  } catch (error) {
    logger.error(`Failed to queue WABA notification: ${data.type}`, {
      component: "WabaQueue",
      metadata: { orderNumber: data.orderNumber, jobId },
    }, error as Error);
  }
}

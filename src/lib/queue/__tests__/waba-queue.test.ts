import { queueWabaNotification, wabaQueue } from "../waba-queue";
import { wabaWorker } from "../waba-worker";
import { getWhatsAppProvider, TestWhatsAppProvider } from "@/lib/whatsapp/watxio";
import assert from "assert";

export async function runWabaQueueTests() {
  console.log("  1. Queuing Order Confirmed Notification...");
  await queueWabaNotification("test_order_conf", {
    type: "ORDER_CONFIRMED",
    orderId: "ord_1",
    orderNumber: "INW-TEST",
    phone: "+919876543210"
  });

  // Wait a moment for worker to process
  await new Promise(res => setTimeout(res, 2000));

  const provider = getWhatsAppProvider() as TestWhatsAppProvider;
  
  const msg1 = provider.sentMessages.find(m => m.templateName === "order_confirmed");
  assert(msg1, "Order confirmed template not found");
  assert(msg1.parameters?.[0] === "INW-TEST", "Order number not passed");

  console.log("  2. Queuing Shipped Notification...");
  await queueWabaNotification("test_order_shipped", {
    type: "SHIPPED",
    orderId: "ord_1",
    orderNumber: "INW-TEST",
    phone: "+919876543210",
    metadata: {
      courierName: "Delhivery",
      awb: "123456789"
    }
  });

  await new Promise(res => setTimeout(res, 2000));

  const msg2 = provider.sentMessages.find(m => m.templateName === "order_shipped");
  assert(msg2, "Shipped template not found");
  assert(msg2.parameters?.[1] === "Delhivery", "Courier not passed");

  console.log("  3. Validating duplicate Job ID prevention (Idempotency)...");
  // Enqueue same job ID
  await queueWabaNotification("test_order_conf", {
    type: "ORDER_CONFIRMED",
    orderId: "ord_1",
    orderNumber: "INW-TEST",
    phone: "+919876543210"
  });
  
  await new Promise(res => setTimeout(res, 2000));
  
  const dupes = provider.sentMessages.filter(m => m.templateName === "order_confirmed");
  assert(dupes.length === 1, "Idempotency failed, duplicate message sent");
  
  // Cleanup
  if (wabaWorker) await wabaWorker.close();
  if (wabaQueue) await wabaQueue.close();

  console.log("  ✔ All WABA queue tests passed successfully!");
}

if (require.main === module) {
  runWabaQueueTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

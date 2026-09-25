import { 
  sendTransactionalEmail, 
  sendOrderConfirmationEmail, 
  sendShippingEmail, 
  sendDeliveryEmail, 
  sendConsultationEnquiryEmail 
} from "../email-service";
import assert from "assert";

export async function runEmailTests() {
  console.log("  1. Testing Email Delivery with no API key (Mock mode)...");
  
  // By default during tests RESEND_API_KEY is not set or we can rely on mock mode
  const res1 = await sendTransactionalEmail({
    to: "test@example.com",
    subject: "Test",
    html: "<p>Test</p>",
  });
  assert(res1.success === true, "Transactional email should succeed in mock mode");
  
  console.log("  2. Testing Order Confirmation Template...");
  const res2 = await sendOrderConfirmationEmail({
    orderNumber: "ORD-123",
    customerName: "John",
    customerEmail: "john@example.com",
    createdAt: new Date(),
    totalPaise: 100000,
    items: [{ productName: "Wallpaper", quantity: 1, totalPricePaise: 100000 }],
  });
  assert(res2.success === true);
  
  console.log("  3. Testing Shipping Template...");
  const res3 = await sendShippingEmail({
    orderNumber: "ORD-123",
    customerName: "John",
    customerEmail: "john@example.com",
    courierName: "Delhivery",
    awb: "123456789",
    trackingUrl: "https://track.example.com",
  });
  assert(res3.success === true);
  
  console.log("  4. Testing Delivery Template...");
  const res4 = await sendDeliveryEmail({
    orderNumber: "ORD-123",
    customerName: "John",
    customerEmail: "john@example.com",
  });
  assert(res4.success === true);
  
  console.log("  5. Testing Consultation Template...");
  const res5 = await sendConsultationEnquiryEmail({
    name: "Jane",
    phone: "9999999999",
    message: "Hello world",
    source: "web"
  });
  assert(res5.success === true);
  
  console.log("  ✔ All Email tests passed successfully!");
}

if (require.main === module) {
  runEmailTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export function getRazorpayConfig(): RazorpayConfig {
  return {
    keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
}

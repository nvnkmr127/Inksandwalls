import assert from "node:assert/strict";
import {
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  generateTestRazorpaySignature,
} from "../razorpay-service";
import { checkCodEligibility } from "../cod-service";
import type { CodConfig } from "../types";

export function runPaymentGateTests() {
  console.log("--> Running Micro-Phase 07.06: Payment Gate & Verification Tests...");

  const testSecret = "secret_test_key_12345";

  // -------------------------------------------------------------
  // 1. Razorpay Signature Verification
  // -------------------------------------------------------------
  console.log("  1. Testing Razorpay Signature Verification...");

  const validOrderId = "order_N0vEmB3r123";
  const validPaymentId = "pay_D3cEmB3r456";
  const validSignature = generateTestRazorpaySignature(
    validOrderId,
    validPaymentId,
    testSecret
  );

  const isValid = verifyRazorpaySignature(
    {
      razorpayOrderId: validOrderId,
      razorpayPaymentId: validPaymentId,
      razorpaySignature: validSignature,
    },
    testSecret
  );
  assert.strictEqual(isValid, true, "Valid signature must verify successfully");

  // Invalid signature
  const isInvalid = verifyRazorpaySignature(
    {
      razorpayOrderId: validOrderId,
      razorpayPaymentId: validPaymentId,
      razorpaySignature: "invalid_tampered_signature_hex",
    },
    testSecret
  );
  assert.strictEqual(isInvalid, false, "Tampered signature must be rejected");

  // Wrong payment ID
  const wrongPaymentValid = verifyRazorpaySignature(
    {
      razorpayOrderId: validOrderId,
      razorpayPaymentId: "pay_different_id_789",
      razorpaySignature: validSignature,
    },
    testSecret
  );
  assert.strictEqual(wrongPaymentValid, false, "Signature must not match wrong payment ID");

  // Empty fields
  assert.strictEqual(
    verifyRazorpaySignature(
      {
        razorpayOrderId: "",
        razorpayPaymentId: validPaymentId,
        razorpaySignature: validSignature,
      },
      testSecret
    ),
    false,
    "Empty orderId must fail verification"
  );

  // -------------------------------------------------------------
  // 2. Razorpay Webhook Signature Verification
  // -------------------------------------------------------------
  console.log("  2. Testing Razorpay Webhook Signature Verification...");

  const webhookPayload = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_123", amount: 50000 } } },
  });
  const webhookSecret = "whsec_super_secret_999";
  const validWebhookSig = require("node:crypto")
    .createHmac("sha256", webhookSecret)
    .update(webhookPayload)
    .digest("hex");

  assert.strictEqual(
    verifyRazorpayWebhookSignature(webhookPayload, validWebhookSig, webhookSecret),
    true,
    "Valid webhook payload and signature must pass"
  );

  assert.strictEqual(
    verifyRazorpayWebhookSignature(webhookPayload, "tampered_sig", webhookSecret),
    false,
    "Invalid webhook signature must fail"
  );

  // -------------------------------------------------------------
  // 3. Cash on Delivery (COD) Eligibility Engine
  // -------------------------------------------------------------
  console.log("  3. Testing Cash on Delivery (COD) Eligibility Engine...");

  const customConfig: CodConfig = {
    enabled: true,
    minOrderValuePaise: 50000, // ₹500
    maxOrderValuePaise: 5000000, // ₹50,000
    allowedPincodes: [],
    blockedPincodes: ["110001", "700001"],
  };

  // 3a. Eligible checkout
  const eligibleRes = checkCodEligibility({
    pincode: "500001",
    totalAmountPaise: 250000, // ₹2,500
    isDeliverable: true,
    config: customConfig,
  });
  assert.strictEqual(eligibleRes.eligible, true);
  assert.strictEqual(eligibleRes.reason, "COD_AVAILABLE");

  // 3b. Ineligible / Blocked pincode
  const blockedRes = checkCodEligibility({
    pincode: "110001",
    totalAmountPaise: 250000,
    isDeliverable: true,
    config: customConfig,
  });
  assert.strictEqual(blockedRes.eligible, false);
  assert.strictEqual(blockedRes.reason, "PINCODE_NOT_ELIGIBLE");

  // 3c. Invalid pincode format
  const invalidPincodeRes = checkCodEligibility({
    pincode: "5000",
    totalAmountPaise: 250000,
    isDeliverable: true,
    config: customConfig,
  });
  assert.strictEqual(invalidPincodeRes.eligible, false);
  assert.strictEqual(invalidPincodeRes.reason, "INVALID_PINCODE");

  // 3d. Order value below minimum threshold
  const belowMinRes = checkCodEligibility({
    pincode: "500001",
    totalAmountPaise: 20000, // ₹200 < ₹500
    isDeliverable: true,
    config: customConfig,
  });
  assert.strictEqual(belowMinRes.eligible, false);
  assert.strictEqual(belowMinRes.reason, "ORDER_VALUE_BELOW_MINIMUM");

  // 3e. Order value above maximum threshold
  const aboveMaxRes = checkCodEligibility({
    pincode: "500001",
    totalAmountPaise: 6000000, // ₹60,000 > ₹50,000
    isDeliverable: true,
    config: customConfig,
  });
  assert.strictEqual(aboveMaxRes.eligible, false);
  assert.strictEqual(aboveMaxRes.reason, "ORDER_VALUE_ABOVE_MAXIMUM");

  // 3f. Delivery not serviceable
  const undeliverableRes = checkCodEligibility({
    pincode: "500001",
    totalAmountPaise: 250000,
    isDeliverable: false,
    config: customConfig,
  });
  assert.strictEqual(undeliverableRes.eligible, false);
  assert.strictEqual(undeliverableRes.reason, "DELIVERY_NOT_SERVICEABLE");

  // 3g. COD globally disabled
  const disabledConfig: CodConfig = { ...customConfig, enabled: false };
  const disabledRes = checkCodEligibility({
    pincode: "500001",
    totalAmountPaise: 250000,
    isDeliverable: true,
    config: disabledConfig,
  });
  assert.strictEqual(disabledRes.eligible, false);
  assert.strictEqual(disabledRes.reason, "COD_DISABLED");

  console.log("  ✔ All Payment Gate & Verification tests passed successfully!");
}

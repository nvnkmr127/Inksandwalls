import assert from "node:assert/strict";
import { getRazorpayConfig } from "../razorpay-config";

export function runRazorpayConfigTests() {
  const config = getRazorpayConfig();
  assert.ok(config.keyId);
}

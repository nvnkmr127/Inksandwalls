import assert from "node:assert";
import {
  matchesPincodePattern,
  matchesState,
  calculateRuleSpecificity,
  resolveShippingRule,
  DEFAULT_SHIPPING_RULE,
} from "../shipping-engine";
import { validatePincode, isPincodeDeliverable } from "@/lib/pincode/pincode-service";
import type { ShippingRuleData } from "../types";

export function runShippingEngineTests() {
  console.log("--> Running Micro-Phase 07.02: Shipping Rule & Resolution Tests...");

  // -------------------------------------------------------------
  // Test 1: PIN Code Validation & Formatting
  // -------------------------------------------------------------
  console.log("  1. Testing PIN Code Validation...");
  const validPincode = validatePincode("500001");
  assert.strictEqual(validPincode.valid, true);
  assert.strictEqual(validPincode.formattedPincode, "500001");
  assert.strictEqual(validPincode.isDeliverable, true);
  assert.strictEqual(validPincode.state, "Telangana");
  assert.strictEqual(validPincode.city, "Hyderabad");

  const spacedPincode = validatePincode(" 560 001 ");
  assert.strictEqual(spacedPincode.valid, true);
  assert.strictEqual(spacedPincode.formattedPincode, "560001");
  assert.strictEqual(spacedPincode.state, "Karnataka");

  const invalidFormat = validatePincode("012345");
  assert.strictEqual(invalidFormat.valid, false);

  const nonNumeric = validatePincode("50000A");
  assert.strictEqual(nonNumeric.valid, false);

  const restrictedPincode = validatePincode("999999");
  assert.strictEqual(restrictedPincode.valid, true);
  assert.strictEqual(restrictedPincode.isDeliverable, false);
  assert.strictEqual(isPincodeDeliverable("999999"), false);

  // -------------------------------------------------------------
  // Test 2: Pincode Pattern & State Matching
  // -------------------------------------------------------------
  console.log("  2. Testing Pattern & State Matching...");
  assert.strictEqual(matchesPincodePattern("*", "500001"), true);
  assert.strictEqual(matchesPincodePattern(null, "500001"), true);
  assert.strictEqual(matchesPincodePattern("500*", "500081"), true);
  assert.strictEqual(matchesPincodePattern("500*", "560001"), false);
  assert.strictEqual(matchesPincodePattern("500001, 500002, 500003", "500002"), true);
  assert.strictEqual(matchesPincodePattern("500001, 500002", "500004"), false);

  assert.strictEqual(matchesState(null, "Telangana"), true);
  assert.strictEqual(matchesState("All", "Maharashtra"), true);
  assert.strictEqual(matchesState("Telangana", "telangana"), true);
  assert.strictEqual(matchesState("Karnataka", "Tamil Nadu"), false);

  // -------------------------------------------------------------
  // Test 3: Specificity Scoring & Priority Ordering
  // -------------------------------------------------------------
  console.log("  3. Testing Specificity Scoring & Priority Ordering...");
  const ruleGlobal: ShippingRuleData = {
    id: "rule-global",
    name: "Global Rule",
    shippingCostPaise: 15000,
    isDeliverable: true,
    priority: 0,
    isActive: true,
  };
  const ruleState: ShippingRuleData = {
    id: "rule-state",
    name: "Telangana Rule",
    state: "Telangana",
    shippingCostPaise: 10000,
    isDeliverable: true,
    priority: 1,
    isActive: true,
  };
  const rulePrefix: ShippingRuleData = {
    id: "rule-prefix",
    name: "Hyderabad Metro Rule",
    pincodePattern: "500*",
    shippingCostPaise: 8000,
    isDeliverable: true,
    priority: 2,
    isActive: true,
  };
  const ruleExact: ShippingRuleData = {
    id: "rule-exact",
    name: "Local Depot Free",
    pincodePattern: "500081",
    shippingCostPaise: 0,
    isDeliverable: true,
    priority: 3,
    isActive: true,
  };

  assert.strictEqual(calculateRuleSpecificity(ruleGlobal, "500081"), 0);
  assert.strictEqual(calculateRuleSpecificity(ruleState, "500081"), 10);
  assert.strictEqual(calculateRuleSpecificity(rulePrefix, "500081"), 20);
  assert.strictEqual(calculateRuleSpecificity(ruleExact, "500081"), 30);

  // Resolution with all rules active -> should choose exact match
  const resExact = resolveShippingRule({
    pincode: "500081",
    state: "Telangana",
    subtotalPaise: 50000,
    rules: [ruleGlobal, ruleState, rulePrefix, ruleExact],
  });
  assert.strictEqual(resExact.appliedRule?.id, "rule-exact");
  assert.strictEqual(resExact.shippingPaise, 0);

  // Resolution for 500001 -> should match rulePrefix
  const resPrefix = resolveShippingRule({
    pincode: "500001",
    state: "Telangana",
    subtotalPaise: 50000,
    rules: [ruleGlobal, ruleState, rulePrefix, ruleExact],
  });
  assert.strictEqual(resPrefix.appliedRule?.id, "rule-prefix");
  assert.strictEqual(resPrefix.shippingPaise, 8000);

  // -------------------------------------------------------------
  // Test 4: Free Shipping Threshold Logic
  // -------------------------------------------------------------
  console.log("  4. Testing Free Shipping Thresholds...");
  const ruleWithThreshold: ShippingRuleData = {
    id: "rule-threshold",
    name: "Express Delivery with Threshold",
    shippingCostPaise: 20000, // ₹200
    freeShippingThresholdPaise: 100000, // ₹1,000
    isDeliverable: true,
    priority: 10,
    isActive: true,
  };

  // Order below threshold (₹800 = 80000 paise)
  const resBelowThreshold = resolveShippingRule({
    pincode: "500001",
    subtotalPaise: 80000,
    rules: [ruleWithThreshold],
  });
  assert.strictEqual(resBelowThreshold.isDeliverable, true);
  assert.strictEqual(resBelowThreshold.shippingPaise, 20000);
  assert.strictEqual(resBelowThreshold.isFreeShipping, false);
  assert.strictEqual(resBelowThreshold.amountRemainingForFreeShippingPaise, 20000); // 100000 - 80000 = 20000 paise (₹200)

  // Order meeting threshold exactly (₹1,000 = 100000 paise)
  const resAtThreshold = resolveShippingRule({
    pincode: "500001",
    subtotalPaise: 100000,
    rules: [ruleWithThreshold],
  });
  assert.strictEqual(resAtThreshold.shippingPaise, 0);
  assert.strictEqual(resAtThreshold.isFreeShipping, true);
  assert.strictEqual(resAtThreshold.amountRemainingForFreeShippingPaise, 0);

  // Order exceeding threshold (₹1,500 = 150000 paise)
  const resAboveThreshold = resolveShippingRule({
    pincode: "500001",
    subtotalPaise: 150000,
    rules: [ruleWithThreshold],
  });
  assert.strictEqual(resAboveThreshold.shippingPaise, 0);
  assert.strictEqual(resAboveThreshold.isFreeShipping, true);

  // -------------------------------------------------------------
  // Test 5: Undeliverable Rules & Blocked Delivery
  // -------------------------------------------------------------
  console.log("  5. Testing Undeliverable Rules...");
  const ruleBlocked: ShippingRuleData = {
    id: "rule-blocked-zone",
    name: "Remote Hill Area - Unserviceable",
    pincodePattern: "171001", // Shimla
    shippingCostPaise: 0,
    isDeliverable: false,
    priority: 50,
    isActive: true,
  };

  const resBlocked = resolveShippingRule({
    pincode: "171001",
    subtotalPaise: 500000,
    rules: [ruleGlobal, ruleBlocked],
  });
  assert.strictEqual(resBlocked.isDeliverable, false);
  assert.strictEqual(resBlocked.shippingPaise, 0);
  assert.ok(resBlocked.validationError?.includes("not available"));

  // -------------------------------------------------------------
  // Test 6: Default Fallback Rule
  // -------------------------------------------------------------
  console.log("  6. Testing Default Fallback Rule...");
  const resDefault = resolveShippingRule({
    pincode: "400001",
    subtotalPaise: 50000, // ₹500
  });
  assert.strictEqual(resDefault.isDeliverable, true);
  assert.strictEqual(resDefault.shippingPaise, DEFAULT_SHIPPING_RULE.shippingCostPaise);
  assert.strictEqual(resDefault.appliedRule?.id, DEFAULT_SHIPPING_RULE.id);

  console.log("  ✔ All Shipping Rule & Resolution tests passed successfully!");
}

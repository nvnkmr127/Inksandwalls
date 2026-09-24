import { validatePincode } from "@/lib/pincode/pincode-service";
import type {
  ShippingRuleData,
  ShippingResolutionInput,
  ShippingResolutionResult,
} from "./types";

/**
 * Default fallback shipping rule for nationwide delivery.
 * - Standard fee: ₹150 (15,000 paise)
 * - Free shipping threshold: ₹1,500 (150,000 paise)
 */
export const DEFAULT_SHIPPING_RULE: ShippingRuleData = {
  id: "default-standard-delivery",
  name: "Standard Delivery",
  description: "Standard nationwide surface shipping",
  pincodePattern: "*",
  state: null,
  minOrderValuePaise: 0,
  maxOrderValuePaise: null,
  shippingCostPaise: 15000,
  freeShippingThresholdPaise: 150000,
  isDeliverable: true,
  priority: 0,
  isActive: true,
};

/**
 * Evaluates whether a target pincode matches a rule's pincode pattern.
 * Supports:
 * - Exact match: "500001"
 * - Prefix wildcard: "500*" or "50*"
 * - Comma-separated list: "500001, 500002, 500003"
 * - Universal wildcard: "*" or null/empty
 */
export function matchesPincodePattern(pattern: string | null | undefined, pincode: string): boolean {
  if (!pattern || pattern.trim() === "" || pattern.trim() === "*") {
    return true;
  }

  const cleanPincode = pincode.replace(/\s+/g, "").trim();
  const subPatterns = pattern.split(",").map((p) => p.trim());

  for (const p of subPatterns) {
    if (!p) continue;
    if (p === cleanPincode) return true;
    if (p.endsWith("*")) {
      const prefix = p.slice(0, -1);
      if (cleanPincode.startsWith(prefix)) return true;
    }
  }

  return false;
}

/**
 * Evaluates whether a target state matches a rule's state.
 */
export function matchesState(ruleState: string | null | undefined, targetState: string | null | undefined): boolean {
  if (!ruleState || ruleState.trim() === "" || ruleState.trim().toLowerCase() === "all") {
    return true;
  }
  if (!targetState) {
    return false;
  }
  return ruleState.trim().toLowerCase() === targetState.trim().toLowerCase();
}

/**
 * Computes specificity score for deterministic precedence:
 * - Exact pincode match in pattern: +30
 * - Wildcard prefix pincode match: +20
 * - Specific state match: +10
 * - Universal fallback: +0
 */
export function calculateRuleSpecificity(rule: ShippingRuleData, pincode: string): number {
  let score = 0;
  const pattern = rule.pincodePattern?.trim();

  if (pattern && pattern !== "*") {
    const subPatterns = pattern.split(",").map((p) => p.trim());
    if (subPatterns.includes(pincode)) {
      score += 30; // exact pincode match
    } else if (subPatterns.some((p) => p.endsWith("*") && pincode.startsWith(p.slice(0, -1)))) {
      score += 20; // prefix match
    }
  }

  if (rule.state && rule.state.trim() !== "" && rule.state.trim().toLowerCase() !== "all") {
    score += 10; // state match
  }

  return score;
}

/**
 * Resolves the applicable shipping rule and calculates authoritative shipping cost.
 *
 * Precedence Order:
 * 1. Filter active rules that satisfy subtotal value bounds [minOrderValuePaise, maxOrderValuePaise].
 * 2. Filter rules matching address pincode and state.
 * 3. Sort rules deterministically by:
 *    - `priority * 100 + specificityScore` (DESC)
 *    - `shippingCostPaise` (ASC)
 *    - `id` (ASC)
 * 4. Apply free shipping threshold on eligible subtotal.
 */
export function resolveShippingRule(
  input: ShippingResolutionInput
): ShippingResolutionResult {
  const { pincode, state, subtotalPaise } = input;

  // 1. Validate PIN code
  const pincodeValidation = validatePincode(pincode);
  if (!pincodeValidation.valid) {
    return {
      isDeliverable: false,
      shippingPaise: 0,
      isFreeShipping: false,
      freeShippingThresholdPaise: null,
      amountRemainingForFreeShippingPaise: null,
      appliedRule: null,
      validationError: pincodeValidation.error || "Invalid PIN code.",
    };
  }

  if (!pincodeValidation.isDeliverable) {
    return {
      isDeliverable: false,
      shippingPaise: 0,
      isFreeShipping: false,
      freeShippingThresholdPaise: null,
      amountRemainingForFreeShippingPaise: null,
      appliedRule: null,
      validationError: pincodeValidation.error || "Delivery is unavailable to this postal code.",
    };
  }

  const effectiveState = state || pincodeValidation.state || null;
  const availableRules = input.rules && input.rules.length > 0 ? input.rules : [DEFAULT_SHIPPING_RULE];

  // 2. Filter matching rules
  const matchingRules = availableRules.filter((rule) => {
    if (!rule.isActive) return false;

    // Subtotal range check
    if (rule.minOrderValuePaise != null && subtotalPaise < rule.minOrderValuePaise) {
      return false;
    }
    if (rule.maxOrderValuePaise != null && subtotalPaise > rule.maxOrderValuePaise) {
      return false;
    }

    // Pincode pattern match
    if (!matchesPincodePattern(rule.pincodePattern, pincodeValidation.formattedPincode)) {
      return false;
    }

    // State match
    if (!matchesState(rule.state, effectiveState)) {
      return false;
    }

    return true;
  });

  if (matchingRules.length === 0) {
    // If custom rules provided but none match, check fallback default rule
    if (DEFAULT_SHIPPING_RULE.isActive) {
      matchingRules.push(DEFAULT_SHIPPING_RULE);
    } else {
      return {
        isDeliverable: false,
        shippingPaise: 0,
        isFreeShipping: false,
        freeShippingThresholdPaise: null,
        amountRemainingForFreeShippingPaise: null,
        appliedRule: null,
        validationError: "No applicable shipping rule found for this delivery address.",
      };
    }
  }

  // 3. Sort by deterministic precedence
  matchingRules.sort((a, b) => {
    const scoreA = a.priority * 100 + calculateRuleSpecificity(a, pincodeValidation.formattedPincode);
    const scoreB = b.priority * 100 + calculateRuleSpecificity(b, pincodeValidation.formattedPincode);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    if (a.shippingCostPaise !== b.shippingCostPaise) {
      return a.shippingCostPaise - b.shippingCostPaise;
    }

    return a.id.localeCompare(b.id);
  });

  const bestRule = matchingRules[0];

  // 4. Check if rule marks zone as undeliverable
  if (!bestRule.isDeliverable) {
    return {
      isDeliverable: false,
      shippingPaise: 0,
      isFreeShipping: false,
      freeShippingThresholdPaise: null,
      amountRemainingForFreeShippingPaise: null,
      appliedRule: bestRule,
      validationError: `Delivery is not available to ${pincodeValidation.formattedPincode}${
        bestRule.name ? ` (${bestRule.name})` : ""
      }.`,
    };
  }

  // 5. Evaluate Free Shipping Threshold on Authoritative Subtotal
  let isFreeShipping = false;
  let shippingPaise = Math.max(0, bestRule.shippingCostPaise);
  let amountRemaining: number | null = null;

  if (bestRule.freeShippingThresholdPaise != null && bestRule.freeShippingThresholdPaise > 0) {
    if (subtotalPaise >= bestRule.freeShippingThresholdPaise) {
      shippingPaise = 0;
      isFreeShipping = true;
      amountRemaining = 0;
    } else {
      amountRemaining = Math.max(0, bestRule.freeShippingThresholdPaise - subtotalPaise);
    }
  } else if (shippingPaise === 0) {
    isFreeShipping = true;
    amountRemaining = 0;
  }

  return {
    isDeliverable: true,
    shippingPaise,
    isFreeShipping,
    freeShippingThresholdPaise: bestRule.freeShippingThresholdPaise || null,
    amountRemainingForFreeShippingPaise: amountRemaining,
    appliedRule: bestRule,
    validationError: null,
  };
}

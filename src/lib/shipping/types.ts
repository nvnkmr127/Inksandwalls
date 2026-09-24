export interface ShippingRuleData {
  id: string;
  name: string;
  description?: string | null;
  pincodePattern?: string | null; // e.g. "500*", "500001, 500002", or null/"*"
  state?: string | null; // e.g. "Telangana", "Maharashtra", or null
  minOrderValuePaise?: number | null;
  maxOrderValuePaise?: number | null;
  shippingCostPaise: number;
  freeShippingThresholdPaise?: number | null;
  isDeliverable: boolean;
  priority: number;
  isActive: boolean;
}

export interface ShippingResolutionInput {
  pincode: string;
  state?: string | null;
  subtotalPaise: number;
  rules?: ShippingRuleData[];
}

export interface ShippingResolutionResult {
  isDeliverable: boolean;
  shippingPaise: number;
  isFreeShipping: boolean;
  freeShippingThresholdPaise: number | null;
  amountRemainingForFreeShippingPaise: number | null;
  appliedRule: ShippingRuleData | null;
  validationError?: string | null;
}

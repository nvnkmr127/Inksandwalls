import { Order, OrderItem, FulfillmentStatus } from "@prisma/client";

export interface ReturnEligibilityResult {
  eligible: boolean;
  reason?: string;
  returnableItems: OrderItem[];
  nonReturnableItems: OrderItem[];
}

export function checkReturnEligibility(
  order: Order,
  items: OrderItem[]
): ReturnEligibilityResult {
  const returnableItems = items.filter((item) => item.returnable);
  const nonReturnableItems = items.filter((item) => !item.returnable);

  if (
    order.fulfillmentStatus === FulfillmentStatus.RETURN_REQUESTED ||
    order.fulfillmentStatus === FulfillmentStatus.RETURNED
  ) {
    return {
      eligible: false,
      reason: "Return already requested or processed",
      returnableItems,
      nonReturnableItems,
    };
  }

  // PRD implies order state allows it. Usually DELIVERED or SHIPPED. 
  // Let's rely on the transition rules: SHIPPED -> RETURN_REQUESTED and DELIVERED -> RETURN_REQUESTED are valid.
  if (
    order.fulfillmentStatus !== FulfillmentStatus.SHIPPED &&
    order.fulfillmentStatus !== FulfillmentStatus.DELIVERED
  ) {
    return {
      eligible: false,
      reason: `Order is in an invalid fulfillment state for return (${order.fulfillmentStatus})`,
      returnableItems,
      nonReturnableItems,
    };
  }

  if (returnableItems.length === 0) {
    return {
      eligible: false,
      reason: "No returnable items in this order",
      returnableItems,
      nonReturnableItems,
    };
  }

  return {
    eligible: true,
    returnableItems,
    nonReturnableItems,
  };
}

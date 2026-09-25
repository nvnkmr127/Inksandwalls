import { FulfillmentStatus, PaymentStatus } from "@prisma/client";

export const FULFILLMENT_STATUS_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  [FulfillmentStatus.CONFIRMED]: [
    FulfillmentStatus.IN_PRODUCTION,
    FulfillmentStatus.CANCELLED,
  ],
  [FulfillmentStatus.IN_PRODUCTION]: [
    FulfillmentStatus.READY_TO_SHIP,
    FulfillmentStatus.CANCELLED,
  ],
  [FulfillmentStatus.READY_TO_SHIP]: [
    FulfillmentStatus.SHIPPED,
    FulfillmentStatus.CANCELLED,
  ],
  [FulfillmentStatus.SHIPPED]: [
    FulfillmentStatus.DELIVERED,
    FulfillmentStatus.RETURN_REQUESTED,
  ],
  [FulfillmentStatus.DELIVERED]: [
    FulfillmentStatus.RETURN_REQUESTED,
  ],
  [FulfillmentStatus.CANCELLED]: [],
  [FulfillmentStatus.RETURN_REQUESTED]: [
    FulfillmentStatus.RETURNED,
    FulfillmentStatus.DELIVERED, // Denied return -> stays delivered
  ],
  [FulfillmentStatus.RETURNED]: [],
};

export const TERMINAL_FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  FulfillmentStatus.CANCELLED,
  FulfillmentStatus.RETURNED,
];

export function isValidFulfillmentTransition(
  currentStatus: FulfillmentStatus,
  nextStatus: FulfillmentStatus
): boolean {
  if (currentStatus === nextStatus) return true;
  return FULFILLMENT_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function isTerminalFulfillmentStatus(status: FulfillmentStatus): boolean {
  return TERMINAL_FULFILLMENT_STATUSES.includes(status);
}

import assert from "node:assert/strict";
import { FulfillmentStatus, PaymentStatus, PaymentMethod, Role } from "@prisma/client";
import { isValidFulfillmentTransition, isTerminalFulfillmentStatus } from "../status";
import { getAdminOrders } from "../order-list-service";
import * as guards from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

// Mock guards
const originalRequireAdmin = guards.requireAdmin;
const originalPrismaOrderFindMany = prisma.order.findMany;
const originalPrismaOrderCount = prisma.order.count;

export async function runOrderListTests() {
  console.log("--> Running Micro-Phase 08.01: Admin Order List Tests...");

  console.log("  1. Testing Status Model rules...");
  assert.strictEqual(
    isValidFulfillmentTransition(FulfillmentStatus.CONFIRMED, FulfillmentStatus.IN_PRODUCTION),
    true
  );
  assert.strictEqual(
    isValidFulfillmentTransition(FulfillmentStatus.CONFIRMED, FulfillmentStatus.SHIPPED),
    false,
    "Cannot skip IN_PRODUCTION/READY_TO_SHIP"
  );
  assert.strictEqual(
    isValidFulfillmentTransition(FulfillmentStatus.SHIPPED, FulfillmentStatus.DELIVERED),
    true
  );
  assert.strictEqual(
    isValidFulfillmentTransition(FulfillmentStatus.DELIVERED, FulfillmentStatus.RETURN_REQUESTED),
    true
  );
  
  assert.strictEqual(isTerminalFulfillmentStatus(FulfillmentStatus.DELIVERED), true);
  assert.strictEqual(isTerminalFulfillmentStatus(FulfillmentStatus.CANCELLED), true);
  assert.strictEqual(isTerminalFulfillmentStatus(FulfillmentStatus.CONFIRMED), false);


  console.log("  2. Testing Admin Authorization...");
  let adminAuthCalled = false;
  // @ts-ignore
  guards.requireAdmin = async () => {
    adminAuthCalled = true;
    return { id: "admin-1", role: Role.STORE_ADMIN };
  };

  // @ts-ignore
  prisma.order.findMany = async (args) => {
    return [{ id: "order-1", orderNumber: "ORD-123" }];
  };
  // @ts-ignore
  prisma.order.count = async (args) => {
    return 1;
  };

  try {
    const res = await getAdminOrders({});
    assert.strictEqual(adminAuthCalled, true, "Must require admin auth");
    assert.strictEqual(res.orders.length, 1);
  } finally {
    // Restore
    // @ts-ignore
    guards.requireAdmin = originalRequireAdmin;
  }

  console.log("  3. Testing Search, Filter, Sort, Pagination parameters assembly...");
  // @ts-ignore
  guards.requireAdmin = async () => ({ id: "admin-1", role: Role.STORE_ADMIN });
  
  let capturedArgs: any = null;
  // @ts-ignore
  prisma.order.findMany = async (args) => {
    capturedArgs = args;
    return [];
  };
  // @ts-ignore
  prisma.order.count = async (args) => 0;

  // Test search & filters
  await getAdminOrders({
    page: 2,
    pageSize: 20,
    search: "ORD-123",
    paymentStatus: PaymentStatus.PAID,
    fulfillmentStatus: FulfillmentStatus.SHIPPED,
    paymentMethod: PaymentMethod.RAZORPAY,
    sortBy: "totalPaise",
    sortDirection: "asc",
  });

  assert.strictEqual(capturedArgs.skip, 20); // (2 - 1) * 20
  assert.strictEqual(capturedArgs.take, 20);
  assert.strictEqual(capturedArgs.orderBy.totalPaise, "asc");
  assert.strictEqual(capturedArgs.where.paymentStatus, "PAID");
  assert.strictEqual(capturedArgs.where.fulfillmentStatus, "SHIPPED");
  assert.strictEqual(capturedArgs.where.paymentMethod, "RAZORPAY");
  assert.ok(capturedArgs.where.OR, "Must include search OR clauses");

  // Restore mocks
  // @ts-ignore
  prisma.order.findMany = originalPrismaOrderFindMany;
  // @ts-ignore
  prisma.order.count = originalPrismaOrderCount;
  // @ts-ignore
  guards.requireAdmin = originalRequireAdmin;

  console.log("  All Order List tests passed.\n");
}

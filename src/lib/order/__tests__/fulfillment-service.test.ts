// @ts-nocheck
import { transitionOrderFulfillment } from "../fulfillment-service";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { FulfillmentStatus } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/audit";
import * as guards from "@/lib/auth/guards";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

jest.mock("@/lib/auth/guards", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/audit/audit", () => ({
  recordAuditEvent: jest.fn(),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
}));

describe("transitionOrderFulfillment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should enforce admin authorization", async () => {
    (requireAdmin as jest.Mock).mockRejectedValueOnce(new Error("AuthError"));

    await expect(
      transitionOrderFulfillment("ord-123", FulfillmentStatus.IN_PRODUCTION)
    ).rejects.toThrow("AuthError");

    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("should throw if order not found", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      transitionOrderFulfillment("ord-unknown", FulfillmentStatus.IN_PRODUCTION)
    ).rejects.toThrow("Order not found");
  });

  it("should reject invalid transition (e.g., CONFIRMED -> DELIVERED)", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ord-1",
      fulfillmentStatus: FulfillmentStatus.CONFIRMED,
    });

    await expect(
      transitionOrderFulfillment("ord-1", FulfillmentStatus.DELIVERED)
    ).rejects.toThrow("Invalid transition from CONFIRMED to DELIVERED");
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("should reject transitions from a terminal state", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ord-1",
      fulfillmentStatus: FulfillmentStatus.DELIVERED,
    });

    await expect(
      transitionOrderFulfillment("ord-1", FulfillmentStatus.CONFIRMED)
    ).rejects.toThrow("Invalid transition");
  });

  it("should process valid transition and create audit log", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ord-1",
      fulfillmentStatus: FulfillmentStatus.CONFIRMED,
    });
    const updatedOrder = {
      id: "ord-1",
      fulfillmentStatus: FulfillmentStatus.IN_PRODUCTION,
    };
    (prisma.order.update as jest.Mock).mockResolvedValueOnce(updatedOrder);

    const result = await transitionOrderFulfillment("ord-1", FulfillmentStatus.IN_PRODUCTION);

    expect(result).toEqual(updatedOrder);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: {
        id: "ord-1",
        fulfillmentStatus: FulfillmentStatus.CONFIRMED,
      },
      data: {
        fulfillmentStatus: FulfillmentStatus.IN_PRODUCTION,
      },
    });

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        action: "UPDATE_FULFILLMENT_STATUS",
        resourceType: "ORDER",
        resourceId: "ord-1",
        metadata: {
          previousStatus: FulfillmentStatus.CONFIRMED,
          newStatus: FulfillmentStatus.IN_PRODUCTION,
        },
      }),
      expect.anything()
    );
  });

  it("should securely set shippedAt when transitioning to SHIPPED", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ord-1",
      fulfillmentStatus: FulfillmentStatus.READY_TO_SHIP,
    });
    (prisma.order.update as jest.Mock).mockResolvedValueOnce({});

    await transitionOrderFulfillment("ord-1", FulfillmentStatus.SHIPPED);

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fulfillmentStatus: FulfillmentStatus.SHIPPED,
          shippedAt: expect.any(Date),
        }),
      })
    );
  });
});

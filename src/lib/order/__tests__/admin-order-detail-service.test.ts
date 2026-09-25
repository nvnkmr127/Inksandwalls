// @ts-nocheck
import { getAdminOrderDetail } from "../admin-order-detail-service";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth/guards", () => ({
  requireAdmin: jest.fn(),
}));

describe("getAdminOrderDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should enforce admin authorization", async () => {
    (requireAdmin as jest.Mock).mockRejectedValueOnce(new Error("AuthError"));

    await expect(getAdminOrderDetail("test-order-id")).rejects.toThrow("AuthError");
    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("should return null if order is not found", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce(undefined);
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const result = await getAdminOrderDetail("unknown-id");
    
    expect(result).toBeNull();
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: "unknown-id" },
      include: {
        items: true,
        payments: true,
        customer: { select: { id: true, userId: true } },
      },
    });
  });

  it("should return the order with its items, payments, and customer", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce(undefined);
    const mockOrder = {
      id: "ord-123",
      orderNumber: "ORD-123",
      items: [{ id: "item-1", productName: "Wallpaper" }],
      payments: [{ id: "pay-1", provider: "RAZORPAY" }],
      customer: { id: "cust-1", userId: "user-1" },
    };
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce(mockOrder);

    const result = await getAdminOrderDetail("ord-123");
    
    expect(result).toEqual(mockOrder);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: "ord-123" },
      include: {
        items: true,
        payments: true,
        customer: { select: { id: true, userId: true } },
      },
    });
  });
});

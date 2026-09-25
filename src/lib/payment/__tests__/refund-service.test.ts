// @ts-nocheck
import { processRazorpayRefund } from "../refund-service";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/audit/audit";
import { issueRazorpayRefund } from "../razorpay-service";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
    },
    refund: {
      create: jest.fn(),
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

jest.mock("../razorpay-service", () => ({
  issueRazorpayRefund: jest.fn(),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(() => Promise.resolve(new Map())),
}));

describe("processRazorpayRefund", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should enforce admin authorization", async () => {
    (requireAdmin as jest.Mock).mockRejectedValueOnce(new Error("AuthError"));

    await expect(processRazorpayRefund("ord-1", 1000)).rejects.toThrow("AuthError");
  });

  it("should reject if no successful Razorpay payment exists", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ord-1",
      payments: [],
      refunds: [],
    });

    await expect(processRazorpayRefund("ord-1", 1000)).rejects.toThrow(
      "No successful Razorpay payment found for this order"
    );
  });

  it("should reject if refund amount exceeds max refundable", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ord-1",
      payments: [
        { id: "pay-1", providerPaymentId: "rzp-1", amountPaise: 5000 },
      ],
      refunds: [
        { amountPaise: 3000, status: "PROCESSED" }, // Already refunded 3000
      ],
    });

    await expect(processRazorpayRefund("ord-1", 2500)).rejects.toThrow(
      "Refund amount exceeds remaining refundable amount (2000)"
    );
  });

  it("should process valid refund, call Razorpay, and audit", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ord-1",
      orderNumber: "INW-1",
      payments: [{ id: "pay-1", providerPaymentId: "rzp-1", amountPaise: 5000 }],
      refunds: [],
    });

    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({ id: "ref-1", status: "INITIATED" });
    
    (issueRazorpayRefund as jest.Mock).mockResolvedValueOnce({
      id: "rfnd_rzp_123",
      status: "processed",
    });

    (prisma.refund.update as jest.Mock).mockResolvedValueOnce({
      id: "ref-1",
      status: "PROCESSED",
      providerRefundId: "rfnd_rzp_123",
    });

    const result = await processRazorpayRefund("ord-1", 1000);

    expect(prisma.refund.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amountPaise: 1000, status: "INITIATED" }),
    });

    expect(issueRazorpayRefund).toHaveBeenCalledWith("rzp-1", 1000, { orderId: "INW-1" });
    
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROCESS_RAZORPAY_REFUND" }),
      expect.anything()
    );

    expect(result.status).toBe("PROCESSED");
  });

  it("should mark refund as FAILED and audit if Razorpay call fails", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({ id: "admin-1" });
    (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "ord-1",
      orderNumber: "INW-1",
      payments: [{ id: "pay-1", providerPaymentId: "rzp-1", amountPaise: 5000 }],
      refunds: [],
    });

    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({ id: "ref-1", status: "INITIATED" });
    
    (issueRazorpayRefund as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));

    await expect(processRazorpayRefund("ord-1", 1000)).rejects.toThrow("Network Error");

    expect(prisma.refund.update).toHaveBeenCalledWith({
      where: { id: "ref-1" },
      data: { status: "FAILED" },
    });

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROCESS_RAZORPAY_REFUND_FAILED" }),
      expect.anything()
    );
  });
});

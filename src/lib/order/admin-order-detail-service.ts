import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { Order, OrderItem, Payment } from "@prisma/client";

export type AdminOrderDetail = Order & {
  items: OrderItem[];
  payments: Payment[];
  refunds: any[]; // Or Refund[] if exported from prisma client properly
  customer: {
    id: string;
    userId: string | null;
  } | null;
};

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  // Enforce admin auth
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: true,
      refunds: true,
      customer: {
        select: { id: true, userId: true },
      },
    },
  });

  return order;
}

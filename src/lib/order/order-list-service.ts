import "server-only";
import { prisma } from "@/lib/prisma";
import { FulfillmentStatus, PaymentStatus, PaymentMethod, Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";

export interface GetOrdersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  paymentMethod?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
  sortBy?: "createdAt" | "totalPaise" | "orderNumber";
  sortDirection?: "asc" | "desc";
}

export interface GetOrdersResult {
  orders: any[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ALLOWED_SORT_FIELDS = ["createdAt", "totalPaise", "orderNumber"];

export async function getAdminOrders(params: GetOrdersParams): Promise<GetOrdersResult> {
  // Enforce admin auth
  await requireAdmin();

  const page = Math.max(1, params.page || 1);
  // Cap max page size to 100 for safety
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
  const skip = (page - 1) * pageSize;

  const where: Prisma.OrderWhereInput = {};

  if (params.search) {
    where.OR = [
      { orderNumber: { contains: params.search, mode: "insensitive" } },
      { customerEmail: { contains: params.search, mode: "insensitive" } },
      { customerName: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.paymentStatus) {
    where.paymentStatus = params.paymentStatus;
  }
  
  if (params.fulfillmentStatus) {
    where.fulfillmentStatus = params.fulfillmentStatus;
  }

  if (params.paymentMethod) {
    where.paymentMethod = params.paymentMethod;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }

  const sortField = params.sortBy && ALLOWED_SORT_FIELDS.includes(params.sortBy) 
    ? params.sortBy 
    : "createdAt";
  const sortDirection = params.sortDirection === "asc" ? "asc" : "desc";

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
      skip,
      take: pageSize,
      include: {
        customer: {
          select: { id: true, userId: true }
        }
      }
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

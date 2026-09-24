import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit/audit";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { validateCouponInput } from "./validation";
import type { CurrentUser } from "@/lib/auth/session";

export interface ListCouponsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "active" | "inactive" | "expired" | "upcoming" | string;
  discountType?: "all" | "PERCENTAGE" | "FIXED_AMOUNT" | string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const ALLOWED_SORT_FIELDS = new Set([
  "code",
  "discountType",
  "discountValue",
  "minCartValuePaise",
  "maxDiscountPaise",
  "startDate",
  "expiryDate",
  "usageLimit",
  "perCustomerLimit",
  "currentUsageCount",
  "isActive",
  "createdAt",
  "updatedAt",
]);

/**
 * Create a new coupon with server-side validation and transactional audit logging.
 */
export async function createCoupon(
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const validated = validateCouponInput(input);

  // Check unique code constraint
  const existingCode = await prisma.coupon.findUnique({
    where: { code: validated.code },
  });

  if (existingCode) {
    throw new ValidationError(
      `A coupon with code '${validated.code}' already exists. Please specify a unique code.`
    );
  }

  return await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.create({
      data: validated,
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.COUPON_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.COUPON,
        resourceId: coupon.id,
        metadata: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minCartValuePaise: coupon.minCartValuePaise,
          maxDiscountPaise: coupon.maxDiscountPaise,
          startDate: coupon.startDate?.toISOString() ?? null,
          expiryDate: coupon.expiryDate?.toISOString() ?? null,
          usageLimit: coupon.usageLimit,
          perCustomerLimit: coupon.perCustomerLimit,
          isActive: coupon.isActive,
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return coupon;
  });
}

/**
 * Update an existing coupon with transactional audit logging.
 */
export async function updateCoupon(
  id: string,
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.coupon.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Coupon not found.");
  }

  const validated = validateCouponInput(input);

  // Check code uniqueness if code changed
  if (validated.code !== existing.code) {
    const duplicateCode = await prisma.coupon.findFirst({
      where: {
        code: validated.code,
        NOT: { id },
      },
    });

    if (duplicateCode) {
      throw new ValidationError(
        `A coupon with code '${validated.code}' already exists. Please specify a unique code.`
      );
    }
  }

  // Determine specific audit action
  let action: string = AUDIT_ACTIONS.COUPON_UPDATED;
  if (existing.isActive !== validated.isActive) {
    action = validated.isActive
      ? AUDIT_ACTIONS.COUPON_ACTIVATED
      : AUDIT_ACTIONS.COUPON_DEACTIVATED;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.coupon.update({
      where: { id },
      data: validated,
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action,
        resourceType: AUDIT_RESOURCE_TYPES.COUPON,
        resourceId: updated.id,
        metadata: {
          previous: {
            code: existing.code,
            discountType: existing.discountType,
            discountValue: existing.discountValue,
            minCartValuePaise: existing.minCartValuePaise,
            maxDiscountPaise: existing.maxDiscountPaise,
            startDate: existing.startDate?.toISOString() ?? null,
            expiryDate: existing.expiryDate?.toISOString() ?? null,
            usageLimit: existing.usageLimit,
            perCustomerLimit: existing.perCustomerLimit,
            isActive: existing.isActive,
          },
          current: {
            code: updated.code,
            discountType: updated.discountType,
            discountValue: updated.discountValue,
            minCartValuePaise: updated.minCartValuePaise,
            maxDiscountPaise: updated.maxDiscountPaise,
            startDate: updated.startDate?.toISOString() ?? null,
            expiryDate: updated.expiryDate?.toISOString() ?? null,
            usageLimit: updated.usageLimit,
            perCustomerLimit: updated.perCustomerLimit,
            isActive: updated.isActive,
          },
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return updated;
  });
}

/**
 * Delete a coupon if it has never been used.
 * If historical usage exists, prevents hard deletion to protect transaction integrity.
 */
export async function deleteCoupon(
  id: string,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.coupon.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          usages: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Coupon not found.");
  }

  // Prevent hard-delete if coupon has historical usages
  if (existing.currentUsageCount > 0 || existing._count.usages > 0) {
    throw new ValidationError(
      "Cannot delete a coupon that has been redeemed in customer transactions. Please deactivate the coupon instead."
    );
  }

  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.coupon.delete({
      where: { id },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.COUPON_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.COUPON,
        resourceId: id,
        metadata: {
          code: existing.code,
          discountType: existing.discountType,
          discountValue: existing.discountValue,
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return deleted;
  });
}

/**
 * Get a single coupon by ID including recent usage records.
 */
export async function getCouponById(id: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      usages: {
        orderBy: { usedAt: "desc" },
        take: 20,
        include: {
          customer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          usages: true,
          carts: true,
        },
      },
    },
  });

  if (!coupon) {
    throw new NotFoundError("Coupon not found.");
  }

  return coupon;
}

/**
 * List coupons with server-side search, filtering, whitelist sorting, and pagination.
 */
export async function listCoupons(options: ListCouponsOptions = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const rawPageSize = Number(options.pageSize) || 10;
  const pageSize = Math.min(100, Math.max(1, rawPageSize));

  const search = typeof options.search === "string" ? options.search.trim() : "";
  const status = options.status || "all";
  const discountType = options.discountType || "all";

  // Controlled sort whitelist
  const rawSort = typeof options.sort === "string" ? options.sort : "createdAt";
  const sortField = ALLOWED_SORT_FIELDS.has(rawSort) ? rawSort : "createdAt";

  const rawOrder = options.order?.toLowerCase();
  const sortOrder: "asc" | "desc" = rawOrder === "asc" ? "asc" : "desc";

  const now = new Date();
  const where: Prisma.CouponWhereInput = {};

  // Search by coupon code
  if (search) {
    where.code = { contains: search, mode: "insensitive" };
  }

  // Discount type filter
  if (discountType === "PERCENTAGE" || discountType === "FIXED_AMOUNT") {
    where.discountType = discountType;
  }

  // Status filters
  if (status === "active") {
    where.isActive = true;
    where.AND = [
      { OR: [{ startDate: null }, { startDate: { lte: now } }] },
      { OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] },
    ];
  } else if (status === "inactive") {
    where.isActive = false;
  } else if (status === "expired") {
    where.expiryDate = { lt: now };
  } else if (status === "upcoming") {
    where.startDate = { gt: now };
  }

  const [totalCount, items] = await prisma.$transaction([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize) || 1,
  };
}

/**
 * Get paginated coupon usages for a specific coupon.
 */
export async function getCouponUsages(couponId: string, page = 1, pageSize = 20) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));

  const where: Prisma.CouponUsageWhereInput = { couponId };

  const [totalCount, items] = await prisma.$transaction([
    prisma.couponUsage.count({ where }),
    prisma.couponUsage.findMany({
      where,
      orderBy: { usedAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      include: {
        customer: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(totalCount / safePageSize) || 1,
  };
}

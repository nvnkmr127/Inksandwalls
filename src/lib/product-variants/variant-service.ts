import "server-only";
import { ProductType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit/audit";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { validateProductVariantInput } from "./validation";
import type { CurrentUser } from "@/lib/auth/session";

export interface ListProductVariantsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "active" | "inactive" | string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const ALLOWED_SORT_FIELDS = new Set(["name", "price", "sortOrder", "createdAt", "updatedAt"]);

/**
 * Create a new ProductVariant with transactional audit event.
 * Enforces FIXED product boundary.
 */
export async function createProductVariant(
  productId: string,
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  if (!productId || typeof productId !== "string") {
    throw new ValidationError("Product ID is required.");
  }

  const validated = validateProductVariantInput(input);

  // 1. Verify product exists & check FIXED product boundary
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new NotFoundError(`Parent product with ID '${productId}' not found.`);
  }

  if (product.productType !== ProductType.FIXED) {
    throw new ValidationError(
      "Product variants can only be created for FIXED price products."
    );
  }

  // 2. Check SKU uniqueness if provided
  if (validated.sku) {
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: validated.sku },
    });

    if (existingSku) {
      throw new ValidationError(
        `A product variant with SKU '${validated.sku}' already exists. SKU must be unique.`
      );
    }
  }

  return await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.create({
      data: {
        productId,
        ...validated,
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true, productType: true },
        },
      },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_VARIANT_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_VARIANT,
        resourceId: variant.id,
        metadata: {
          productId: variant.productId,
          productName: variant.product.name,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          isActive: variant.isActive,
          sortOrder: variant.sortOrder,
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return variant;
  });
}

/**
 * Update an existing ProductVariant with transactional audit event.
 */
export async function updateProductVariant(
  id: string,
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.productVariant.findUnique({
    where: { id },
    include: {
      product: {
        select: { id: true, name: true, slug: true, productType: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Product variant not found.");
  }

  if (existing.product.productType !== ProductType.FIXED) {
    throw new ValidationError(
      "Product variants can only exist on FIXED price products."
    );
  }

  const validated = validateProductVariantInput(input);

  // Check SKU uniqueness if changed
  if (validated.sku && validated.sku !== existing.sku) {
    const duplicateSku = await prisma.productVariant.findFirst({
      where: {
        sku: validated.sku,
        NOT: { id },
      },
    });

    if (duplicateSku) {
      throw new ValidationError(
        `A product variant with SKU '${validated.sku}' already exists. SKU must be unique.`
      );
    }
  }

  // Determine audit action
  let action: string = AUDIT_ACTIONS.PRODUCT_VARIANT_UPDATED;
  if (existing.isActive !== validated.isActive) {
    action = validated.isActive
      ? AUDIT_ACTIONS.PRODUCT_VARIANT_ACTIVATED
      : AUDIT_ACTIONS.PRODUCT_VARIANT_DEACTIVATED;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.productVariant.update({
      where: { id },
      data: validated,
      include: {
        product: {
          select: { id: true, name: true, slug: true, productType: true },
        },
      },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_VARIANT,
        resourceId: updated.id,
        metadata: {
          productId: updated.productId,
          productName: updated.product.name,
          previous: {
            name: existing.name,
            sku: existing.sku,
            price: existing.price,
            isActive: existing.isActive,
            sortOrder: existing.sortOrder,
          },
          current: {
            name: updated.name,
            sku: updated.sku,
            price: updated.price,
            isActive: updated.isActive,
            sortOrder: updated.sortOrder,
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
 * Delete a ProductVariant with transactional audit event.
 */
export async function deleteProductVariant(
  id: string,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.productVariant.findUnique({
    where: { id },
    include: {
      product: {
        select: { id: true, name: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Product variant not found.");
  }

  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.productVariant.delete({
      where: { id },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_VARIANT_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_VARIANT,
        resourceId: id,
        metadata: {
          productId: existing.productId,
          productName: existing.product.name,
          name: existing.name,
          sku: existing.sku,
          price: existing.price,
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
 * Get a single ProductVariant by ID.
 */
export async function getVariantById(id: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id },
    include: {
      product: {
        select: { id: true, name: true, slug: true, productType: true },
      },
    },
  });

  if (!variant) {
    throw new NotFoundError("Product variant not found.");
  }

  return variant;
}

/**
 * Server-side variant list query supporting search, filters, whitelist sorting, and pagination.
 */
export async function listProductVariants(
  productId: string,
  options: ListProductVariantsOptions = {}
) {
  if (!productId || typeof productId !== "string") {
    throw new ValidationError("Product ID is required.");
  }

  // Confirm product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, slug: true, productType: true },
  });

  if (!product) {
    throw new NotFoundError(`Product with ID '${productId}' not found.`);
  }

  const page = Math.max(1, Number(options.page) || 1);
  const rawPageSize = Number(options.pageSize) || 10;
  const pageSize = Math.min(100, Math.max(1, rawPageSize));

  const search = typeof options.search === "string" ? options.search.trim() : "";
  const status = options.status || "all";

  // Controlled sort whitelist
  const rawSort = typeof options.sort === "string" ? options.sort : "sortOrder";
  const sortField = ALLOWED_SORT_FIELDS.has(rawSort) ? rawSort : "sortOrder";

  const rawOrder = options.order?.toLowerCase();
  const sortOrder: "asc" | "desc" = rawOrder === "desc" ? "desc" : "asc";

  const where: Prisma.ProductVariantWhereInput = {
    productId,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  const [totalCount, items] = await prisma.$transaction([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    product,
    items,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize) || 1,
  };
}

import "server-only";
import type { Prisma, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { recordAuditEvent } from "@/lib/audit/audit";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { validateProductInput } from "./validation";
import type { CurrentUser } from "@/lib/auth/session";

export interface ListProductsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "active" | "inactive" | string;
  productType?: "all" | "PER_AREA" | "FIXED" | string;
  categoryId?: "all" | string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const ALLOWED_SORT_FIELDS = new Set(["name", "price", "rate", "createdAt", "updatedAt"]);

/**
 * Create a new Product with transactional audit event.
 */
export async function createProduct(
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const validated = validateProductInput(input);

  // 1. Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: validated.categoryId },
  });

  if (!category) {
    throw new ValidationError(`Selected category with ID '${validated.categoryId}' does not exist.`);
  }

  // 2. Check slug uniqueness
  const existingSlug = await prisma.product.findUnique({
    where: { slug: validated.slug },
  });

  if (existingSlug) {
    throw new ValidationError(
      `A product with slug '${validated.slug}' already exists. Please specify a unique slug.`
    );
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: validated,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT,
        resourceId: product.id,
        metadata: {
          name: product.name,
          slug: product.slug,
          productType: product.productType,
          categoryId: product.categoryId,
          isActive: product.isActive,
          price: product.price,
          rate: product.rate,
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return product;
  });
}

/**
 * Update an existing Product with transactional audit event.
 */
export async function updateProduct(
  id: string,
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.product.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Product not found.");
  }

  const validated = validateProductInput(input);

  // 1. Verify category exists if changed
  if (validated.categoryId !== existing.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: validated.categoryId },
    });

    if (!category) {
      throw new ValidationError(`Selected category with ID '${validated.categoryId}' does not exist.`);
    }
  }

  // 2. Check slug uniqueness if slug has changed
  if (validated.slug !== existing.slug) {
    const duplicateSlug = await prisma.product.findFirst({
      where: {
        slug: validated.slug,
        NOT: { id },
      },
    });

    if (duplicateSlug) {
      throw new ValidationError(
        `A product with slug '${validated.slug}' already exists. Please specify a unique slug.`
      );
    }
  }

  // 3. Determine audit action type
  let action: string = AUDIT_ACTIONS.PRODUCT_UPDATED;
  if (existing.isActive !== validated.isActive) {
    action = validated.isActive
      ? AUDIT_ACTIONS.PRODUCT_ACTIVATED
      : AUDIT_ACTIONS.PRODUCT_DEACTIVATED;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: validated,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT,
        resourceId: updated.id,
        metadata: {
          previous: {
            name: existing.name,
            slug: existing.slug,
            productType: existing.productType,
            isActive: existing.isActive,
            price: existing.price,
            rate: existing.rate,
          },
          current: {
            name: updated.name,
            slug: updated.slug,
            productType: updated.productType,
            isActive: updated.isActive,
            price: updated.price,
            rate: updated.rate,
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
 * Delete a Product with transactional audit event.
 */
export async function deleteProduct(
  id: string,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.product.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Product not found.");
  }

  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.product.delete({
      where: { id },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT,
        resourceId: id,
        metadata: {
          name: existing.name,
          slug: existing.slug,
          productType: existing.productType,
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
 * Get a single Product by ID.
 */
export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  if (!product) {
    throw new NotFoundError("Product not found.");
  }

  return product;
}

/**
 * Server-side product list query supporting search, filters, whitelist sorting, and pagination.
 */
export async function listProducts(options: ListProductsOptions = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const rawPageSize = Number(options.pageSize) || 10;
  const pageSize = Math.min(100, Math.max(1, rawPageSize));

  const search = typeof options.search === "string" ? options.search.trim() : "";
  const status = options.status || "all";
  const productType = options.productType || "all";
  const categoryId = options.categoryId || "all";

  // Controlled sort whitelist
  const rawSort = typeof options.sort === "string" ? options.sort : "createdAt";
  const sortField = ALLOWED_SORT_FIELDS.has(rawSort) ? rawSort : "createdAt";

  const rawOrder = options.order?.toLowerCase();
  const sortOrder: "asc" | "desc" = rawOrder === "asc" ? "asc" : "desc";

  // Build Prisma where filter
  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  if (productType === "PER_AREA" || productType === "FIXED") {
    where.productType = productType as ProductType;
  }

  if (categoryId && categoryId !== "all") {
    where.categoryId = categoryId;
  }

  const [totalCount, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
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

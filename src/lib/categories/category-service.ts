import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { recordAuditEvent } from "@/lib/audit/audit";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { validateCategoryInput } from "./validation";
import type { CurrentUser } from "@/lib/auth/session";

export interface ListCategoriesOptions {
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

const ALLOWED_SORT_FIELDS = new Set(["name", "sortOrder", "createdAt", "updatedAt"]);

/**
 * Create a new Category with transactional audit event.
 */
export async function createCategory(
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const validated = validateCategoryInput(input);

  // Check slug uniqueness
  const existingSlug = await prisma.category.findUnique({
    where: { slug: validated.slug },
  });

  if (existingSlug) {
    throw new ValidationError(
      `A category with slug '${validated.slug}' already exists. Please specify a unique slug.`
    );
  }

  return await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: validated,
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.CATEGORY_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.CATEGORY,
        resourceId: category.id,
        metadata: {
          name: category.name,
          slug: category.slug,
          isActive: category.isActive,
          sortOrder: category.sortOrder,
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return category;
  });
}

/**
 * Update an existing Category with transactional audit event.
 */
export async function updateCategory(
  id: string,
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.category.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Category not found.");
  }

  const validated = validateCategoryInput(input);

  // Check slug uniqueness if slug has changed
  if (validated.slug !== existing.slug) {
    const duplicateSlug = await prisma.category.findFirst({
      where: {
        slug: validated.slug,
        NOT: { id },
      },
    });

    if (duplicateSlug) {
      throw new ValidationError(
        `A category with slug '${validated.slug}' already exists. Please specify a unique slug.`
      );
    }
  }

  // Determine specific audit action type
  let action: string = AUDIT_ACTIONS.CATEGORY_UPDATED;
  if (existing.isActive !== validated.isActive) {
    action = validated.isActive
      ? AUDIT_ACTIONS.CATEGORY_ACTIVATED
      : AUDIT_ACTIONS.CATEGORY_DEACTIVATED;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id },
      data: validated,
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action,
        resourceType: AUDIT_RESOURCE_TYPES.CATEGORY,
        resourceId: updated.id,
        metadata: {
          previous: {
            name: existing.name,
            slug: existing.slug,
            isActive: existing.isActive,
            sortOrder: existing.sortOrder,
          },
          current: {
            name: updated.name,
            slug: updated.slug,
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
 * Delete a Category with transactional audit event.
 */
export async function deleteCategory(
  id: string,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.category.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Category not found.");
  }

  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.category.delete({
      where: { id },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.CATEGORY_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.CATEGORY,
        resourceId: id,
        metadata: {
          name: existing.name,
          slug: existing.slug,
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
 * Get a single category by ID.
 */
export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new NotFoundError("Category not found.");
  }

  return category;
}

/**
 * Server-side category list query supporting search, status filter, whitelist sorting, and pagination.
 */
export async function listCategories(options: ListCategoriesOptions = {}) {
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

  // Build Prisma where filter
  const where: Prisma.CategoryWhereInput = {};


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

  const [totalCount, items] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
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

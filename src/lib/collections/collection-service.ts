import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { recordAuditEvent } from "@/lib/audit/audit";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { validateCollectionInput } from "./validation";
import type { CurrentUser } from "@/lib/auth/session";

export interface ListCollectionsOptions {
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
 * Create a new Collection with transactional audit event.
 */
export async function createCollection(
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const validated = validateCollectionInput(input);

  // Check slug uniqueness
  const existingSlug = await prisma.collection.findUnique({
    where: { slug: validated.slug },
  });

  if (existingSlug) {
    throw new ValidationError(
      `A collection with slug '${validated.slug}' already exists. Please specify a unique slug.`
    );
  }

  return await prisma.$transaction(async (tx) => {
    const collection = await tx.collection.create({
      data: validated,
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.COLLECTION_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.COLLECTION,
        resourceId: collection.id,
        metadata: {
          name: collection.name,
          slug: collection.slug,
          isActive: collection.isActive,
          sortOrder: collection.sortOrder,
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return collection;
  });
}

/**
 * Update an existing Collection with transactional audit event.
 */
export async function updateCollection(
  id: string,
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.collection.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Collection not found.");
  }

  const validated = validateCollectionInput(input);

  // Check slug uniqueness if slug has changed
  if (validated.slug !== existing.slug) {
    const duplicateSlug = await prisma.collection.findFirst({
      where: {
        slug: validated.slug,
        NOT: { id },
      },
    });

    if (duplicateSlug) {
      throw new ValidationError(
        `A collection with slug '${validated.slug}' already exists. Please specify a unique slug.`
      );
    }
  }

  // Determine specific audit action type
  let action: string = AUDIT_ACTIONS.COLLECTION_UPDATED;
  if (existing.isActive !== validated.isActive) {
    action = validated.isActive
      ? AUDIT_ACTIONS.COLLECTION_ACTIVATED
      : AUDIT_ACTIONS.COLLECTION_DEACTIVATED;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.collection.update({
      where: { id },
      data: validated,
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action,
        resourceType: AUDIT_RESOURCE_TYPES.COLLECTION,
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
 * Delete a Collection with transactional audit event.
 */
export async function deleteCollection(
  id: string,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await prisma.collection.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Collection not found.");
  }

  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.collection.delete({
      where: { id },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.COLLECTION_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.COLLECTION,
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
 * Get a single collection by ID.
 */
export async function getCollectionById(id: string) {
  const collection = await prisma.collection.findUnique({
    where: { id },
  });

  if (!collection) {
    throw new NotFoundError("Collection not found.");
  }

  return collection;
}

/**
 * Server-side collection list query supporting search, status filter, whitelist sorting, and pagination.
 */
export async function listCollections(options: ListCollectionsOptions = {}) {
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
  const where: Prisma.CollectionWhereInput = {};

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
    prisma.collection.count({ where }),
    prisma.collection.findMany({
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

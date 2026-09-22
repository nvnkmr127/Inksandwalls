import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit/audit";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { ValidationError, NotFoundError, ExternalServiceError } from "@/lib/errors";
import { validateImageFile } from "@/lib/media/validation";
import { processImageVariants, VARIANT_BREAKPOINTS } from "@/lib/media/pipeline";
import { generateMediaId, generateProductMediaKey } from "@/lib/storage/keys";
import { uploadObject, deleteObject, isR2Configured } from "@/lib/storage/storage";
import {
  sanitizeAltText,
  validateMediaMetadataUpdate,
  validateMediaReorderInput,
} from "./validation";
import { logger } from "@/lib/logger";
import type { CurrentUser } from "@/lib/auth/session";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface UploadProductMediaOptions {
  productId: string;
  buffer: Buffer;
  mimeType: string;
  altText?: string | null;
  actor: CurrentUser;
  reqContext?: RequestContext;
}

/**
 * List all media items belonging to a product, ordered by sortOrder ASC, createdAt ASC.
 */
export async function listProductMedia(productId: string) {
  if (!productId || typeof productId !== "string") {
    throw new ValidationError("Product ID is required.");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, slug: true, productType: true },
  });

  if (!product) {
    throw new NotFoundError(`Product with ID '${productId}' not found.`);
  }

  const items = await prisma.productMedia.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    product,
    items,
  };
}

/**
 * Retrieve a single product media item with IDOR verification.
 */
export async function getProductMediaById(productId: string, mediaId: string) {
  if (!productId || typeof productId !== "string") {
    throw new ValidationError("Product ID is required.");
  }
  if (!mediaId || typeof mediaId !== "string") {
    throw new ValidationError("Media ID is required.");
  }

  const media = await prisma.productMedia.findUnique({
    where: { id: mediaId },
  });

  if (!media) {
    throw new NotFoundError("Product media not found.");
  }

  if (media.productId !== productId) {
    throw new ValidationError("Media does not belong to the specified product.");
  }

  return media;
}

/**
 * Upload a product image, run Sharp variant processing, upload to Cloudflare R2,
 * and persist ProductMedia in Postgres with transactional compensating cleanup on failure.
 */
export async function uploadProductMedia({
  productId,
  buffer,
  mimeType,
  altText,
  actor,
  reqContext,
}: UploadProductMediaOptions) {
  if (!productId || typeof productId !== "string") {
    throw new ValidationError("Product ID is required.");
  }

  // 1. Confirm product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, slug: true },
  });

  if (!product) {
    throw new NotFoundError(`Product with ID '${productId}' not found.`);
  }

  // 2. Validate file payload (size, MIME type, magic bytes)
  const validation = validateImageFile(buffer, mimeType);
  if (!validation.valid) {
    throw new ValidationError(validation.error || "Image file validation failed.");
  }

  const cleanAltText = sanitizeAltText(altText);

  // 3. Process image variants with Sharp
  const pipelineResult = await processImageVariants(buffer);
  const mediaId = generateMediaId();

  // 4. Upload variants to Cloudflare R2
  const uploadedKeys: string[] = [];
  const uploadedVariants: Array<{
    variant: string;
    objectKey: string;
    width: number;
    height: number;
    format: string;
    size: number;
    url: string;
  }> = [];

  let originalKey = "";

  try {
    for (const variant of pipelineResult.variants) {
      const objectKey = generateProductMediaKey({
        productId,
        mediaId,
        variant: variant.name,
        format: variant.format,
      });

      if (variant.name === "original" || !originalKey) {
        originalKey = objectKey;
      }

      if (isR2Configured()) {
        const uploadRes = await uploadObject({
          key: objectKey,
          body: variant.buffer,
          contentType: `image/${variant.format}`,
        });

        uploadedKeys.push(uploadRes.key);
        uploadedVariants.push({
          variant: variant.name,
          objectKey: uploadRes.key,
          width: variant.width,
          height: variant.height,
          format: variant.format,
          size: uploadRes.size,
          url: uploadRes.url,
        });
      } else {
        // Fallback for dev / test mode when R2 credentials are not set
        uploadedKeys.push(objectKey);
        uploadedVariants.push({
          variant: variant.name,
          objectKey,
          width: variant.width,
          height: variant.height,
          format: variant.format,
          size: variant.size,
          url: `/uploads/mock/${objectKey}`,
        });
      }
    }
  } catch (storageError) {
    // Clean up any partially uploaded R2 objects before rethrowing
    for (const key of uploadedKeys) {
      try {
        await deleteObject(key);
      } catch (cleanupErr) {
        logger.error("Failed to clean up partial R2 object after storage error", {
          key,
          error: cleanupErr,
        });
      }
    }
    const msg = storageError instanceof Error ? storageError.message : "R2 upload failed.";
    throw new ExternalServiceError(`Failed to upload media asset to storage: ${msg}`);
  }

  // 5. Check existing media to determine sortOrder and primary image status
  const existingCount = await prisma.productMedia.count({
    where: { productId },
  });

  // If this is the first image for the product, automatically set as primary
  const isPrimary = existingCount === 0;
  const sortOrder = existingCount;

  // 6. Persist ProductMedia record in PostgreSQL with compensating cleanup
  try {
    const media = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        // Ensure atomic reset of any existing primary (guarded by partial unique index)
        await tx.productMedia.updateMany({
          where: { productId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const created = await tx.productMedia.create({
        data: {
          productId,
          objectKey: originalKey,
          altText: cleanAltText,
          width: pipelineResult.sourceMetadata.width,
          height: pipelineResult.sourceMetadata.height,
          format: "webp",
          mimeType,
          size: buffer.byteLength,
          metadata: {
            variants: uploadedVariants.map((v) => ({
              name: v.variant,
              key: v.objectKey,
              width: v.width,
              height: v.height,
              format: v.format,
              size: v.size,
            })),
            source: pipelineResult.sourceMetadata,
          },
          sortOrder,
          isPrimary,
        },
      });

      await recordAuditEvent(
        {
          actorUserId: actor.id,
          action: AUDIT_ACTIONS.PRODUCT_MEDIA_UPLOADED,
          resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_MEDIA,
          resourceId: created.id,
          metadata: {
            productId,
            mediaId: created.id,
            objectKey: created.objectKey,
            altText: created.altText,
            isPrimary: created.isPrimary,
            sortOrder: created.sortOrder,
            width: created.width,
            height: created.height,
            size: created.size,
            variantCount: uploadedVariants.length,
          },
          ipAddress: reqContext?.ipAddress || null,
          userAgent: reqContext?.userAgent || null,
        },
        tx
      );

      return created;
    });

    return media;
  } catch (dbError) {
    // COMPENSATING CLEANUP: Remove uploaded R2 objects when database transaction fails
    logger.error("Database media record creation failed. Initiating compensating R2 cleanup", {
      productId,
      uploadedKeys,
      error: dbError,
    });

    for (const key of uploadedKeys) {
      try {
        await deleteObject(key);
      } catch (cleanupErr) {
        logger.error("Failed to clean up orphaned R2 object during compensating cleanup", {
          key,
          error: cleanupErr,
        });
      }
    }

    throw dbError;
  }
}

/**
 * Atomically set a media item as the primary image for a product.
 * Unsets any existing primary image for this product within a database transaction.
 */
export async function setPrimaryProductMedia(
  productId: string,
  mediaId: string,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await getProductMediaById(productId, mediaId);

  if (existing.isPrimary) {
    return existing; // Already primary, idempotent success
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Unset existing primary image for this product
    await tx.productMedia.updateMany({
      where: { productId, isPrimary: true },
      data: { isPrimary: false },
    });

    // 2. Set the designated media item as primary
    const updated = await tx.productMedia.update({
      where: { id: mediaId },
      data: { isPrimary: true },
    });

    // 3. Record audit event
    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_MEDIA_PRIMARY_SET,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_MEDIA,
        resourceId: mediaId,
        metadata: {
          productId,
          mediaId,
          objectKey: updated.objectKey,
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
 * Atomically reorder product media items.
 * Validates that every media ID in the list belongs to the specified product.
 */
export async function reorderProductMedia(
  productId: string,
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  if (!productId || typeof productId !== "string") {
    throw new ValidationError("Product ID is required.");
  }

  const validated = validateMediaReorderInput(input);
  const { mediaIds } = validated;

  // Confirm product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new NotFoundError(`Product with ID '${productId}' not found.`);
  }

  // Fetch all media items with these IDs belonging to this product
  const existingMedia = await prisma.productMedia.findMany({
    where: {
      id: { in: mediaIds },
      productId,
    },
    select: { id: true },
  });

  if (existingMedia.length !== mediaIds.length) {
    throw new ValidationError(
      "One or more media items do not exist or do not belong to the specified product."
    );
  }

  return await prisma.$transaction(async (tx) => {
    const updatedItems = [];
    for (let index = 0; index < mediaIds.length; index++) {
      const id = mediaIds[index];
      const updated = await tx.productMedia.update({
        where: { id },
        data: { sortOrder: index },
      });
      updatedItems.push(updated);
    }

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_MEDIA_REORDERED,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_MEDIA,
        resourceId: productId,
        metadata: {
          productId,
          mediaIds,
          totalReordered: mediaIds.length,
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return updatedItems;
  });
}

/**
 * Update media metadata (altText).
 * Prevents file replacement or unauthorized modifications.
 */
export async function updateProductMediaMetadata(
  productId: string,
  mediaId: string,
  input: unknown,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await getProductMediaById(productId, mediaId);
  const validated = validateMediaMetadataUpdate(input);

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.productMedia.update({
      where: { id: mediaId },
      data: { altText: validated.altText },
    });

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_MEDIA_UPDATED,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_MEDIA,
        resourceId: mediaId,
        metadata: {
          productId,
          mediaId,
          previousAltText: existing.altText,
          currentAltText: updated.altText,
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
 * Delete a product media item.
 * 1. Verifies ownership.
 * 2. Identifies all R2 objects.
 * 3. Deletes R2 objects first (if storage delete fails, DB record is preserved).
 * 4. Removes ProductMedia record from DB.
 * 5. If the deleted media was primary, promotes the next remaining media to primary.
 */
export async function deleteProductMedia(
  productId: string,
  mediaId: string,
  actor: CurrentUser,
  reqContext?: RequestContext
) {
  const existing = await getProductMediaById(productId, mediaId);

  // Collect all R2 keys associated with this media
  const keysToDelete = new Set<string>();
  if (existing.objectKey) {
    keysToDelete.add(existing.objectKey);
  }

  // Add keys from variant metadata if present
  if (
    existing.metadata &&
    typeof existing.metadata === "object" &&
    "variants" in existing.metadata &&
    Array.isArray((existing.metadata as { variants: unknown[] }).variants)
  ) {
    for (const v of (existing.metadata as { variants: Array<{ key?: string }> }).variants) {
      if (v && typeof v.key === "string") {
        keysToDelete.add(v.key);
      }
    }
  }

  // Fallback: standard variant keys based on breakpoints
  for (const bp of VARIANT_BREAKPOINTS) {
    const standardKey = generateProductMediaKey({
      productId,
      mediaId,
      variant: bp.name,
      format: "webp",
    });
    keysToDelete.add(standardKey);
  }

  // Delete from R2 storage
  for (const key of keysToDelete) {
    try {
      await deleteObject(key);
    } catch (storageErr) {
      logger.error("Failed to delete R2 storage object during media deletion", {
        productId,
        mediaId,
        key,
        error: storageErr,
      });
      throw new ExternalServiceError(
        `Failed to delete media asset from storage. Media record was preserved.`
      );
    }
  }

  // Delete from database in transaction, maintaining primary image validity
  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.productMedia.delete({
      where: { id: mediaId },
    });

    let newlyPromotedPrimaryId: string | null = null;

    // If the deleted item was primary, automatically promote the next remaining media (lowest sortOrder)
    if (existing.isPrimary) {
      const nextPrimary = await tx.productMedia.findFirst({
        where: { productId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      if (nextPrimary) {
        await tx.productMedia.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });
        newlyPromotedPrimaryId = nextPrimary.id;
      }
    }

    await recordAuditEvent(
      {
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_MEDIA_DELETED,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_MEDIA,
        resourceId: mediaId,
        metadata: {
          productId,
          mediaId,
          objectKey: existing.objectKey,
          wasPrimary: existing.isPrimary,
          newlyPromotedPrimaryId,
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      },
      tx
    );

    return {
      deleted,
      newlyPromotedPrimaryId,
    };
  });
}

import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@prisma/client";
import {
  calculatePerAreaPricing,
  calculateFixedPricing,
  validateDimensions,
  type DimensionUnit,
} from "@/lib/pricing/pricing-engine";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const CART_COOKIE_NAME = "inks_cart_session";

export interface CookieStoreAdapter {
  get(name: string): { name: string; value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
}

export interface CartLineSnapshot {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productType: ProductType;
  primaryMediaKey: string | null;
  categoryName: string | null;
  returnable: boolean;
  hsnCode: string | null;
  
  // FIXED variant details (if applicable)
  variantId?: string | null;
  variantName?: string | null;
  sku?: string | null;

  // PER_AREA dimension details (if applicable)
  dimensions?: {
    width: number;
    height: number;
    unit: DimensionUnit;
    widthFt: number;
    heightFt: number;
  };
  area?: {
    enteredAreaSqft: number;
    wastagePct: number;
    wastageAreaSqft: number;
    areaWithWastageSqft: number;
    minAreaSqft: number;
    isMinAreaApplied: boolean;
    billableAreaSqft: number;
    rollWidthFt: number | null;
    panelsNeeded: number | null;
  };
  ratePaise?: number; // Minor units (paise) per sqft

  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
  addedAt: string;
}

export interface CartSession {
  lines: CartLineSnapshot[];
  totalItems: number;
  subtotalPaise: number;
}

export interface AddToCartInput {
  productId: string;
  productType: "PER_AREA" | "FIXED";
  quantity: number;
  // For PER_AREA:
  width?: number;
  height?: number;
  unit?: DimensionUnit;
  // For FIXED:
  variantId?: string | null;
}

/**
 * Retrieve current cart session from HTTP-only cookie.
 */
export async function getCartSession(customStore?: CookieStoreAdapter): Promise<CartSession> {
  try {
    const cookieStore = customStore || (await cookies());
    const raw = cookieStore.get(CART_COOKIE_NAME)?.value;
    if (!raw) {
      return { lines: [], totalItems: 0, subtotalPaise: 0 };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.lines)) {
      return { lines: [], totalItems: 0, subtotalPaise: 0 };
    }

    const lines: CartLineSnapshot[] = parsed.lines;
    const totalItems = lines.reduce((acc, line) => acc + (line.quantity || 1), 0);
    const subtotalPaise = lines.reduce((acc, line) => acc + (line.totalPricePaise || 0), 0);

    return { lines, totalItems, subtotalPaise };
  } catch (error) {
    logger.error("Failed to parse cart session cookie", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { lines: [], totalItems: 0, subtotalPaise: 0 };
  }
}

/**
 * Save updated cart session to HTTP-only cookie.
 */
export async function saveCartSession(
  session: CartSession,
  customStore?: CookieStoreAdapter
): Promise<void> {
  const cookieStore = customStore || (await cookies());
  const serialized = JSON.stringify({
    lines: session.lines,
  });

  cookieStore.set(CART_COOKIE_NAME, serialized, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/**
 * Authoritative Server-side Add to Cart Boundary.
 * Enforces PRD §6 & §8:
 * - Never trusts client-supplied price, rate, or area.
 * - Authenticates product existence and public visibility (isActive = true).
 * - Recalculates price server-side using the canonical pricing engine.
 * - Creates an immutable configuration snapshot for the cart line.
 */
export async function createAuthoritativeCartSnapshot(
  input: AddToCartInput
): Promise<CartLineSnapshot> {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Invalid add to cart payload.");
  }

  // 1. Quantity Validation
  const rawQuantity = Number(input.quantity);
  if (isNaN(rawQuantity) || !Number.isInteger(rawQuantity) || rawQuantity < 1) {
    throw new ValidationError("Quantity must be a positive integer.");
  }
  if (rawQuantity > 99) {
    throw new ValidationError("Quantity cannot exceed 99 units per order.");
  }
  const quantity = rawQuantity;

  // 2. Fetch authoritative Product from database
  if (!input.productId || typeof input.productId !== "string") {
    throw new ValidationError("Product ID is required.");
  }

  const product = await prisma.product.findFirst({
    where: {
      id: input.productId.trim(),
      isActive: true, // Strict visibility guard
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      media: {
        orderBy: [
          { isPrimary: "desc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
        take: 1,
        select: { id: true, objectKey: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  if (!product) {
    throw new ValidationError("The requested product is unavailable or does not exist.");
  }

  // Verify productType match
  if (product.productType !== input.productType) {
    throw new ValidationError("Product type mismatch.");
  }

  const primaryMediaKey = product.media[0]?.objectKey ?? null;
  const categoryName = product.category?.name ?? null;
  const lineId = `line_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const addedAt = new Date().toISOString();

  if (product.productType === ProductType.PER_AREA) {
    // 3A. PER_AREA Validation & Server-Side Recalculation
    const dimValidation = validateDimensions(input.width, input.height, input.unit);
    if (
      !dimValidation.isValid ||
      !dimValidation.sanitizedWidth ||
      !dimValidation.sanitizedHeight ||
      !dimValidation.sanitizedUnit
    ) {
      throw new ValidationError(dimValidation.error || "Invalid dimensions provided.");
    }

    if (!product.rate || product.rate <= 0) {
      throw new ValidationError("Product rate is not configured.");
    }

    const pricing = calculatePerAreaPricing({
      width: dimValidation.sanitizedWidth,
      height: dimValidation.sanitizedHeight,
      unit: dimValidation.sanitizedUnit,
      ratePaise: product.rate,
      wastagePct: product.wastage,
      minAreaSqft: product.minArea,
      rollWidthFt: product.rollWidth,
      quantity,
    });

    return {
      id: lineId,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productType: ProductType.PER_AREA,
      primaryMediaKey,
      categoryName,
      returnable: product.returnable,
      hsnCode: product.hsnCode,
      dimensions: {
        width: pricing.width,
        height: pricing.height,
        unit: pricing.unit,
        widthFt: pricing.widthFt,
        heightFt: pricing.heightFt,
      },
      area: {
        enteredAreaSqft: pricing.enteredAreaSqft,
        wastagePct: pricing.wastagePct,
        wastageAreaSqft: pricing.wastageAreaSqft,
        areaWithWastageSqft: pricing.areaWithWastageSqft,
        minAreaSqft: pricing.minAreaSqft,
        isMinAreaApplied: pricing.isMinAreaApplied,
        billableAreaSqft: pricing.billableAreaSqft,
        rollWidthFt: pricing.rollWidthFt,
        panelsNeeded: pricing.panelsNeeded,
      },
      ratePaise: pricing.ratePaise,
      unitPricePaise: pricing.unitPricePaise,
      quantity,
      totalPricePaise: pricing.totalPricePaise,
      addedAt,
    };
  } else {
    // 3B. FIXED Validation & Server-Side Recalculation
    let selectedVariant = null;
    let unitPricePaise = product.price ?? 0;
    let variantId: string | null = null;
    let variantName: string | null = null;
    let sku: string | null = null;

    if (product.variants.length > 0) {
      if (!input.variantId) {
        throw new ValidationError("Please select a product variant.");
      }
      selectedVariant = product.variants.find((v) => v.id === input.variantId);
      if (!selectedVariant) {
        throw new ValidationError("The selected variant does not exist or is inactive.");
      }
      unitPricePaise = selectedVariant.price;
      variantId = selectedVariant.id;
      variantName = selectedVariant.name;
      sku = selectedVariant.sku;
    } else {
      if (unitPricePaise <= 0) {
        throw new ValidationError("Product price is not configured.");
      }
    }

    const pricing = calculateFixedPricing({
      basePricePaise: unitPricePaise,
      quantity,
    });

    return {
      id: lineId,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productType: ProductType.FIXED,
      primaryMediaKey,
      categoryName,
      returnable: product.returnable,
      hsnCode: product.hsnCode,
      variantId,
      variantName,
      sku,
      unitPricePaise: pricing.unitPricePaise,
      quantity,
      totalPricePaise: pricing.totalPricePaise,
      addedAt,
    };
  }
}

/**
 * Add item to cart and persist session cookie.
 */
export async function addToCart(
  input: AddToCartInput,
  customStore?: CookieStoreAdapter
): Promise<{
  cart: CartSession;
  addedLine: CartLineSnapshot;
}> {
  const snapshot = await createAuthoritativeCartSnapshot(input);

  // Update Cart Session
  const currentSession = await getCartSession(customStore);
  const updatedLines = [...currentSession.lines, snapshot];
  const totalItems = updatedLines.reduce((acc, line) => acc + (line.quantity || 1), 0);
  const subtotalPaise = updatedLines.reduce((acc, line) => acc + (line.totalPricePaise || 0), 0);

  const updatedSession: CartSession = {
    lines: updatedLines,
    totalItems,
    subtotalPaise,
  };

  await saveCartSession(updatedSession, customStore);

  return {
    cart: updatedSession,
    addedLine: snapshot,
  };
}

/**
 * Clear the current cart session.
 */
export async function clearCartSession(customStore?: CookieStoreAdapter): Promise<void> {
  const cookieStore = customStore || (await cookies());
  cookieStore.delete(CART_COOKIE_NAME);
}

import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma, ProductType, CartStatus } from "@prisma/client";
import {
  calculatePerAreaPricing,
  calculateFixedPricing,
  validateDimensions,
  type DimensionUnit,
} from "@/lib/pricing/pricing-engine";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { ValidationError, UnauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const GUEST_CART_COOKIE_NAME = "inks_cart_session_id";

export interface AddToCartInput {
  productId: string;
  productType: "PER_AREA" | "FIXED";
  quantity: number;
  width?: number;
  height?: number;
  unit?: DimensionUnit;
  variantId?: string | null;
  options?: Record<string, unknown> | null;
}

export interface CartItemView {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productType: ProductType;
  primaryMediaKey: string | null;
  categoryName: string | null;
  returnable: boolean;
  hsnCode: string | null;
  isAvailable: boolean;
  priceChanged?: boolean;

  // FIXED variant details
  variantId: string | null;
  variantName: string | null;
  sku: string | null;

  // PER_AREA dimension details
  dimensions: {
    width: number;
    height: number;
    unit: string;
    widthFt: number;
    heightFt: number;
  } | null;
  area: {
    enteredAreaSqft: number;
    wastagePct: number;
    wastageAreaSqft: number;
    areaWithWastageSqft: number;
    minAreaSqft: number;
    isMinAreaApplied: boolean;
    billableAreaSqft: number;
    rollWidthFt: number | null;
    panelsNeeded: number | null;
  } | null;
  ratePaise: number | null;

  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
  configHash: string;
  addedAt: string;
}

export interface StorefrontCartView {
  cartId: string;
  items: CartItemView[];
  totalItems: number;
  subtotalPaise: number;
  hasUnavailableItems: boolean;
  isGuest: boolean;
}

export interface CookieStoreLike {
  get(name: string): { name: string; value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
}

/**
 * Deterministic SHA-256 hash for cart configuration identity.
 * Merges items only when their meaningful configuration is identical.
 */
export function computeConfigurationHash(input: {
  productId: string;
  productType: string;
  variantId?: string | null;
  width?: number | null;
  height?: number | null;
  unit?: string | null;
  options?: Record<string, unknown> | null;
}): string {
  const parts: string[] = [input.productId.trim(), input.productType.trim()];

  if (input.productType === "PER_AREA") {
    const unit = (input.unit || "ft").toLowerCase().trim();
    const width = Number((input.width || 0).toFixed(2));
    const height = Number((input.height || 0).toFixed(2));
    parts.push(unit, String(width), String(height));
  } else {
    parts.push(input.variantId ? input.variantId.trim() : "base");
  }

  if (input.options && Object.keys(input.options).length > 0) {
    const sortedKeys = Object.keys(input.options).sort();
    const normalizedOptions = sortedKeys
      .map((k) => `${k}:${JSON.stringify(input.options![k])}`)
      .join(",");
    parts.push(normalizedOptions);
  }

  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/**
 * Resolve active cart owner context (authenticated Customer vs Guest session).
 * Automatically handles guest-to-customer cart merge if logging in with an active guest cookie.
 */
export async function resolveCartOwner(
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<{
  type: "CUSTOMER" | "GUEST";
  customerId?: string;
  sessionId?: string;
  cartId?: string;
}> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();

  if (currentUser?.id) {
    // Authenticated user: find or ensure Customer record
    let customer = await prisma.customer.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { userId: currentUser.id },
        select: { id: true },
      });
    }

    // Check if a guest cart session exists and needs to be merged
    const guestSessionId = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
    if (guestSessionId) {
      await mergeGuestCartIntoCustomer(guestSessionId, customer.id);
      try {
        cookieStore.delete(GUEST_CART_COOKIE_NAME);
      } catch {
        // Ignored in read-only Server Component contexts where cookie mutation is restricted
      }
    }

    return { type: "CUSTOMER", customerId: customer.id };
  }

  // Guest shopper: resolve or initialize guest session ID
  let sessionId = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  if (!sessionId) {
    sessionId = `gst_${Date.now()}_${createHash("sha256").update(String(Math.random())).digest("hex").substring(0, 16)}`;
    try {
      cookieStore.set(GUEST_CART_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    } catch {
      // Ignored in read-only Server Component contexts where cookie mutation is restricted
    }
  }

  return { type: "GUEST", sessionId };
}

/**
 * Get or create the active database Cart for the current owner.
 */
export async function getOrCreateActiveCart(
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
) {
  const owner = await resolveCartOwner(customStore, customUser);

  if (owner.type === "CUSTOMER" && owner.customerId) {
    let cart = await prisma.cart.findFirst({
      where: {
        customerId: owner.customerId,
        status: CartStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          customerId: owner.customerId,
          status: CartStatus.ACTIVE,
        },
        select: { id: true },
      });
    }

    return { cart, isGuest: false };
  }

  // Guest cart
  let cart = await prisma.cart.findFirst({
    where: {
      sessionId: owner.sessionId,
      status: CartStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        sessionId: owner.sessionId,
        status: CartStatus.ACTIVE,
      },
      select: { id: true },
    });
  }

  return { cart, isGuest: true };
}

/**
 * Merge an existing guest cart into an authenticated customer's cart upon login.
 * Preserves distinct configurations while combining identical configurations.
 */
export async function mergeGuestCartIntoCustomer(
  guestSessionId: string,
  customerId: string
): Promise<void> {
  const guestCart = await prisma.cart.findFirst({
    where: {
      sessionId: guestSessionId,
      status: CartStatus.ACTIVE,
    },
    include: {
      items: true,
    },
  });

  if (!guestCart || guestCart.items.length === 0) {
    return;
  }

  // Use a transaction for safety
  await prisma.$transaction(async (tx) => {
    // Find or create customer's active cart
    let customerCart = await tx.cart.findFirst({
      where: {
        customerId,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: true,
      },
    });

    if (!customerCart) {
      customerCart = await tx.cart.create({
        data: {
          customerId,
          status: CartStatus.ACTIVE,
        },
        include: {
          items: true,
        },
      });
    }

    // Merge each guest item
    for (const guestItem of guestCart.items) {
      const existingCustomerItem = (customerCart.items || []).find(
        (item) => item.configHash === guestItem.configHash
      );

      if (existingCustomerItem) {
        const combinedQty = Math.min(99, existingCustomerItem.quantity + guestItem.quantity);
        await tx.cartItem.update({
          where: { id: existingCustomerItem.id },
          data: {
            quantity: combinedQty,
            totalPricePaise: existingCustomerItem.unitPricePaise * combinedQty,
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: customerCart.id,
            productId: guestItem.productId,
            productName: guestItem.productName,
            productType: guestItem.productType,
            variantId: guestItem.variantId,
            variantName: guestItem.variantName,
            sku: guestItem.sku,
            width: guestItem.width,
            height: guestItem.height,
            unit: guestItem.unit,
            widthFt: guestItem.widthFt,
            heightFt: guestItem.heightFt,
            enteredAreaSqft: guestItem.enteredAreaSqft,
            wastagePct: guestItem.wastagePct,
            wastageAreaSqft: guestItem.wastageAreaSqft,
            areaWithWastageSqft: guestItem.areaWithWastageSqft,
            minAreaSqft: guestItem.minAreaSqft,
            isMinAreaApplied: guestItem.isMinAreaApplied,
            billableAreaSqft: guestItem.billableAreaSqft,
            rollWidthFt: guestItem.rollWidthFt,
            panelsNeeded: guestItem.panelsNeeded,
            ratePaise: guestItem.ratePaise,
            unitPricePaise: guestItem.unitPricePaise,
            quantity: guestItem.quantity,
            totalPricePaise: guestItem.totalPricePaise,
            options: guestItem.options ? (guestItem.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            mediaKey: guestItem.mediaKey,
            returnable: guestItem.returnable,
            hsnCode: guestItem.hsnCode,
            configHash: guestItem.configHash,
          },
        });
      }
    }

    // Retire the guest cart
    await tx.cart.update({
      where: { id: guestCart.id },
      data: {
        status: CartStatus.CONVERTED,
        sessionId: null,
      },
    });
  });

  logger.info("Guest cart merged into customer cart", {
    guestCartId: guestCart.id,
    customerId,
    itemCount: guestCart.items.length,
  });
}

/**
 * Add a product configuration to the active cart.
 * Never trusts client price or area.
 */
export async function addItemToCart(
  input: AddToCartInput,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<StorefrontCartView> {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Invalid add to cart request.");
  }

  // 1. Quantity Validation
  const rawQuantity = Number(input.quantity);
  if (isNaN(rawQuantity) || !Number.isInteger(rawQuantity) || rawQuantity < 1) {
    throw new ValidationError("Quantity must be a positive integer.");
  }
  if (rawQuantity > 99) {
    throw new ValidationError("Quantity cannot exceed 99 units per line.");
  }
  const quantity = rawQuantity;

  // 2. Fetch authoritative Product
  if (!input.productId || typeof input.productId !== "string") {
    throw new ValidationError("Product ID is required.");
  }

  const product = await prisma.product.findFirst({
    where: {
      id: input.productId.trim(),
      isActive: true, // Strict public availability guard
    },
    include: {
      category: { select: { name: true } },
      media: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { objectKey: true },
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

  if (product.productType !== input.productType) {
    throw new ValidationError("Product type mismatch.");
  }

  const primaryMediaKey = product.media[0]?.objectKey ?? null;
  const configHash = computeConfigurationHash({
    productId: product.id,
    productType: product.productType,
    variantId: input.variantId,
    width: input.width,
    height: input.height,
    unit: input.unit,
    options: input.options,
  });

  const { cart } = await getOrCreateActiveCart(customStore, customUser);

  if (product.productType === ProductType.PER_AREA) {
    // 3A. PER_AREA Validation & Server-Side Calculation
    const dimValidation = validateDimensions(input.width, input.height, input.unit);
    if (!dimValidation.isValid || !dimValidation.sanitizedWidth || !dimValidation.sanitizedHeight || !dimValidation.sanitizedUnit) {
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

    // Check if configuration already exists in cart
    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_configHash: {
          cartId: cart.id,
          configHash,
        },
      },
    });

    if (existing) {
      const updatedQty = Math.min(99, existing.quantity + quantity);
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: updatedQty,
          totalPricePaise: pricing.unitPricePaise * updatedQty,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          productName: product.name,
          productType: ProductType.PER_AREA,
          variantId: null,
          variantName: null,
          sku: null,
          width: pricing.width,
          height: pricing.height,
          unit: pricing.unit,
          widthFt: pricing.widthFt,
          heightFt: pricing.heightFt,
          enteredAreaSqft: pricing.enteredAreaSqft,
          wastagePct: pricing.wastagePct,
          wastageAreaSqft: pricing.wastageAreaSqft,
          areaWithWastageSqft: pricing.areaWithWastageSqft,
          minAreaSqft: pricing.minAreaSqft,
          isMinAreaApplied: pricing.isMinAreaApplied,
          billableAreaSqft: pricing.billableAreaSqft,
          rollWidthFt: pricing.rollWidthFt,
          panelsNeeded: pricing.panelsNeeded,
          ratePaise: pricing.ratePaise,
          unitPricePaise: pricing.unitPricePaise,
          quantity,
          totalPricePaise: pricing.totalPricePaise,
          options: input.options ? (input.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          mediaKey: primaryMediaKey,
          returnable: product.returnable,
          hsnCode: product.hsnCode,
          configHash,
        },
      });
    }
  } else {
    // 3B. FIXED Validation & Server-Side Calculation
    let unitPricePaise = product.price ?? 0;
    let variantId: string | null = null;
    let variantName: string | null = null;
    let sku: string | null = null;

    if (product.variants.length > 0) {
      if (!input.variantId) {
        throw new ValidationError("Please select a product variant.");
      }
      const selectedVariant = product.variants.find((v) => v.id === input.variantId);
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

    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_configHash: {
          cartId: cart.id,
          configHash,
        },
      },
    });

    if (existing) {
      const updatedQty = Math.min(99, existing.quantity + quantity);
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: updatedQty,
          totalPricePaise: pricing.unitPricePaise * updatedQty,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          productName: product.name,
          productType: ProductType.FIXED,
          variantId,
          variantName,
          sku,
          width: null,
          height: null,
          unit: null,
          widthFt: null,
          heightFt: null,
          enteredAreaSqft: null,
          wastagePct: null,
          wastageAreaSqft: null,
          areaWithWastageSqft: null,
          minAreaSqft: null,
          isMinAreaApplied: null,
          billableAreaSqft: null,
          rollWidthFt: null,
          panelsNeeded: null,
          ratePaise: null,
          unitPricePaise: pricing.unitPricePaise,
          quantity,
          totalPricePaise: pricing.totalPricePaise,
          options: input.options ? (input.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          mediaKey: primaryMediaKey,
          returnable: product.returnable,
          hsnCode: product.hsnCode,
          configHash,
        },
      });
    }
  }

  return await getCartWithFreshPricing(customStore, customUser);
}

/**
 * Update the quantity of a specific cart item.
 * Strictly verifies cart ownership and positive integer bounds (1..99).
 */
export async function updateCartItemQuantity(
  itemId: string,
  quantity: number,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<StorefrontCartView> {
  const rawQuantity = Number(quantity);
  if (isNaN(rawQuantity) || !Number.isInteger(rawQuantity) || rawQuantity < 1) {
    throw new ValidationError("Quantity must be a positive integer.");
  }
  if (rawQuantity > 99) {
    throw new ValidationError("Quantity cannot exceed 99 units per line.");
  }

  const { cart } = await getOrCreateActiveCart(customStore, customUser);

  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cartId: cart.id, // Strict ownership guard
    },
    include: {
      product: { select: { isActive: true } },
    },
  });

  if (!item) {
    throw new UnauthorizedError("Cart item not found or you do not have permission to update it.");
  }

  if (!item.product.isActive) {
    throw new ValidationError("This product is currently inactive and cannot be ordered.");
  }

  const totalPricePaise = item.unitPricePaise * rawQuantity;

  await prisma.cartItem.update({
    where: { id: item.id },
    data: {
      quantity: rawQuantity,
      totalPricePaise,
    },
  });

  return await getCartWithFreshPricing(customStore, customUser);
}

/**
 * Remove an item from the cart with strict ownership verification.
 */
export async function removeCartItem(
  itemId: string,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<StorefrontCartView> {
  const { cart } = await getOrCreateActiveCart(customStore, customUser);

  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cartId: cart.id, // Strict ownership guard
    },
  });

  if (!item) {
    throw new UnauthorizedError("Cart item not found or access denied.");
  }

  await prisma.cartItem.delete({
    where: { id: item.id },
  });

  return await getCartWithFreshPricing(customStore, customUser);
}

/**
 * Clear all items from the current active cart.
 */
export async function clearCart(
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<StorefrontCartView> {
  const { cart } = await getOrCreateActiveCart(customStore, customUser);

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  return await getCartWithFreshPricing(customStore, customUser);
}

/**
 * Update the configuration of a specific PER_AREA cart item.
 * Strictly verifies cart ownership.
 */
export async function updateCartItemConfiguration(
  itemId: string,
  updates: { width?: number; height?: number; unit?: DimensionUnit; options?: Record<string, unknown> },
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<StorefrontCartView> {
  const { cart } = await getOrCreateActiveCart(customStore, customUser);

  const item = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cartId: cart.id, // Strict ownership guard
    },
    include: {
      product: true,
    },
  });

  if (!item) {
    throw new UnauthorizedError("Cart item not found or you do not have permission to update it.");
  }

  if (item.productType !== ProductType.PER_AREA) {
    throw new ValidationError("Configuration update is only supported for custom-sized products.");
  }

  if (!item.product.isActive) {
    throw new ValidationError("This product is currently inactive and cannot be updated.");
  }

  const width = updates.width ?? item.width ?? 0;
  const height = updates.height ?? item.height ?? 0;
  const unit = updates.unit ?? (item.unit as DimensionUnit) ?? "ft";
  const options = updates.options ?? (item.options as Record<string, unknown> | null) ?? undefined;

  const dimValidation = validateDimensions(width, height, unit);
  if (!dimValidation.isValid || !dimValidation.sanitizedWidth || !dimValidation.sanitizedHeight || !dimValidation.sanitizedUnit) {
    throw new ValidationError(dimValidation.error || "Invalid dimensions provided.");
  }

  if (!item.product.rate || item.product.rate <= 0) {
    throw new ValidationError("Product rate is not configured.");
  }

  const pricing = calculatePerAreaPricing({
    width: dimValidation.sanitizedWidth,
    height: dimValidation.sanitizedHeight,
    unit: dimValidation.sanitizedUnit,
    ratePaise: item.product.rate,
    wastagePct: item.product.wastage,
    minAreaSqft: item.product.minArea,
    rollWidthFt: item.product.rollWidth,
    quantity: item.quantity,
  });

  const configHash = computeConfigurationHash({
    productId: item.productId,
    productType: item.productType,
    variantId: item.variantId,
    width: pricing.width,
    height: pricing.height,
    unit: pricing.unit,
    options,
  });

  // Check if target configuration already exists in the cart
  const existing = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      configHash,
      id: { not: item.id },
    },
  });

  if (existing) {
    // Merge into the existing item
    const updatedQty = Math.min(99, existing.quantity + item.quantity);
    await prisma.$transaction([
      prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: updatedQty,
          totalPricePaise: pricing.unitPricePaise * updatedQty,
        },
      }),
      prisma.cartItem.delete({
        where: { id: item.id },
      }),
    ]);
  } else {
    // Update the current item in place
    await prisma.cartItem.update({
      where: { id: item.id },
      data: {
        width: pricing.width,
        height: pricing.height,
        unit: pricing.unit,
        widthFt: pricing.widthFt,
        heightFt: pricing.heightFt,
        enteredAreaSqft: pricing.enteredAreaSqft,
        wastagePct: pricing.wastagePct,
        wastageAreaSqft: pricing.wastageAreaSqft,
        areaWithWastageSqft: pricing.areaWithWastageSqft,
        minAreaSqft: pricing.minAreaSqft,
        isMinAreaApplied: pricing.isMinAreaApplied,
        billableAreaSqft: pricing.billableAreaSqft,
        rollWidthFt: pricing.rollWidthFt,
        panelsNeeded: pricing.panelsNeeded,
        ratePaise: pricing.ratePaise,
        unitPricePaise: pricing.unitPricePaise,
        totalPricePaise: pricing.totalPricePaise,
        options: options ? (options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        configHash,
      },
    });
  }

  return await getCartWithFreshPricing(customStore, customUser);
}

/**
 * Retrieve active cart with authoritative pricing verification and stale price detection.
 */
export async function getCartWithFreshPricing(
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<StorefrontCartView> {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();

  // If unauthenticated guest has no session cookie yet, cart is definitively empty
  const guestSessionId = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  if (!currentUser?.id && !guestSessionId) {
    return {
      cartId: "",
      items: [],
      totalItems: 0,
      subtotalPaise: 0,
      hasUnavailableItems: false,
      isGuest: true,
    };
  }

  const { cart, isGuest } = await getOrCreateActiveCart(cookieStore, currentUser);

  const dbItems = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          rate: true,
          price: true,
          wastage: true,
          minArea: true,
          rollWidth: true,
          returnable: true,
          hsnCode: true,
          category: { select: { name: true } },
          media: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: { objectKey: true },
          },
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          isActive: true,
        },
      },
    },
  });

  let hasUnavailableItems = false;
  const items: CartItemView[] = [];

  for (const item of dbItems) {
    const isProductActive = item.product.isActive;
    const isVariantActive = item.variantId ? Boolean(item.variant && item.variant.isActive) : true;
    const isAvailable = isProductActive && isVariantActive;

    if (!isAvailable) {
      hasUnavailableItems = true;
    }

    let priceChanged = false;
    let authoritativeUnitPrice = item.unitPricePaise;
    let authoritativeRatePaise = item.ratePaise;

    // Detect pricing changes if product is active
    if (isAvailable) {
      if (item.productType === ProductType.PER_AREA) {
        if (
          item.product.rate &&
          (item.product.rate !== item.ratePaise ||
            item.product.wastage !== item.wastagePct ||
            item.product.minArea !== item.minAreaSqft)
        ) {
          const freshPricing = calculatePerAreaPricing({
            width: item.width || 0,
            height: item.height || 0,
            unit: (item.unit as DimensionUnit) || "ft",
            ratePaise: item.product.rate,
            wastagePct: item.product.wastage,
            minAreaSqft: item.product.minArea,
            rollWidthFt: item.product.rollWidth,
            quantity: item.quantity,
          });

          if (freshPricing.unitPricePaise !== item.unitPricePaise || freshPricing.ratePaise !== item.ratePaise) {
            priceChanged = true;
            authoritativeUnitPrice = freshPricing.unitPricePaise;
            authoritativeRatePaise = freshPricing.ratePaise;

            // Automatically synchronize cart line to authoritative pricing
            await prisma.cartItem.update({
              where: { id: item.id },
              data: {
                ratePaise: freshPricing.ratePaise,
                wastagePct: freshPricing.wastagePct,
                minAreaSqft: freshPricing.minAreaSqft,
                billableAreaSqft: freshPricing.billableAreaSqft,
                unitPricePaise: freshPricing.unitPricePaise,
                totalPricePaise: freshPricing.totalPricePaise,
              },
            });
          }
        }
      } else {
        const currentVariantPrice = item.variant ? item.variant.price : item.product.price;
        if (currentVariantPrice && currentVariantPrice !== item.unitPricePaise) {
          priceChanged = true;
          authoritativeUnitPrice = currentVariantPrice;

          await prisma.cartItem.update({
            where: { id: item.id },
            data: {
              unitPricePaise: currentVariantPrice,
              totalPricePaise: currentVariantPrice * item.quantity,
            },
          });
        }
      }
    }

    const lineTotal = authoritativeUnitPrice * item.quantity;

    items.push({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productSlug: item.product.slug,
      productType: item.productType,
      primaryMediaKey: item.mediaKey || item.product.media[0]?.objectKey || null,
      categoryName: item.product.category?.name || null,
      returnable: item.returnable,
      hsnCode: item.hsnCode,
      isAvailable,
      priceChanged,
      variantId: item.variantId,
      variantName: item.variantName,
      sku: item.sku,
      dimensions:
        item.productType === ProductType.PER_AREA && item.width && item.height && item.unit
          ? {
              width: item.width,
              height: item.height,
              unit: item.unit,
              widthFt: item.widthFt || item.width,
              heightFt: item.heightFt || item.height,
            }
          : null,
      area:
        item.productType === ProductType.PER_AREA && item.billableAreaSqft
          ? {
              enteredAreaSqft: item.enteredAreaSqft || 0,
              wastagePct: item.wastagePct || 0,
              wastageAreaSqft: item.wastageAreaSqft || 0,
              areaWithWastageSqft: item.areaWithWastageSqft || 0,
              minAreaSqft: item.minAreaSqft || 0,
              isMinAreaApplied: Boolean(item.isMinAreaApplied),
              billableAreaSqft: item.billableAreaSqft,
              rollWidthFt: item.rollWidthFt,
              panelsNeeded: item.panelsNeeded,
            }
          : null,
      ratePaise: authoritativeRatePaise,
      unitPricePaise: authoritativeUnitPrice,
      quantity: item.quantity,
      totalPricePaise: lineTotal,
      configHash: item.configHash,
      addedAt: item.createdAt.toISOString(),
    });
  }

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotalPaise = items.reduce((acc, item) => acc + item.totalPricePaise, 0);

  return {
    cartId: cart.id,
    items,
    totalItems,
    subtotalPaise,
    hasUnavailableItems,
    isGuest,
  };
}

/**
 * Simple helper to retrieve total item count for header badge.
 */
export async function getCartItemCount(
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
): Promise<number> {
  try {
    const cookieStore = customStore || (await cookies());
    const currentUser = customUser !== undefined ? customUser : await getCurrentUser();

    const guestSessionId = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
    if (!currentUser?.id && !guestSessionId) {
      return 0;
    }

    const { cart } = await getOrCreateActiveCart(cookieStore, currentUser);
    const result = await prisma.cartItem.aggregate({
      where: { cartId: cart.id },
      _sum: { quantity: true },
    });
    return result._sum.quantity || 0;
  } catch {
    return 0;
  }
}

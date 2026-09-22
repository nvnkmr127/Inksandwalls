"use server";

import {
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  getCartWithFreshPricing,
  getCartItemCount,
  type AddToCartInput,
  type StorefrontCartView,
} from "@/lib/cart/cart-service";
import { ValidationError, UnauthorizedError } from "@/lib/errors";

export interface CartActionResult {
  success: boolean;
  error?: string;
  cart?: StorefrontCartView;
  totalItems?: number;
}

export async function addToCartAction(input: AddToCartInput): Promise<CartActionResult> {
  try {
    const cart = await addItemToCart(input);
    return {
      success: true,
      cart,
      totalItems: cart.totalItems,
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add item to cart.",
    };
  }
}

export async function updateCartQuantityAction(
  itemId: string,
  quantity: number
): Promise<CartActionResult> {
  try {
    const cart = await updateCartItemQuantity(itemId, quantity);
    return {
      success: true,
      cart,
      totalItems: cart.totalItems,
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update item quantity.",
    };
  }
}

export async function removeCartItemAction(itemId: string): Promise<CartActionResult> {
  try {
    const cart = await removeCartItem(itemId);
    return {
      success: true,
      cart,
      totalItems: cart.totalItems,
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove item from cart.",
    };
  }
}

export async function clearCartAction(): Promise<CartActionResult> {
  try {
    const cart = await clearCart();
    return {
      success: true,
      cart,
      totalItems: cart.totalItems,
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear cart.",
    };
  }
}

export async function getCartAction(): Promise<StorefrontCartView> {
  return await getCartWithFreshPricing();
}

export async function getCartItemCountAction(): Promise<number> {
  return await getCartItemCount();
}

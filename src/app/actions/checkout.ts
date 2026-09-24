"use server";

import { revalidatePath } from "next/cache";
import {
  recalculateCheckoutSession,
  selectCheckoutSavedAddress,
  setCheckoutAddress,
  updateCheckoutContact,
  type CheckoutSessionSnapshot,
} from "@/lib/checkout/checkout-service";
import { applyCouponToCart, removeCouponFromCart } from "@/lib/cart/cart-service";
import type { AddressInput } from "@/lib/address/address-schema";

export async function recalculateCheckoutAction(
  checkoutId: string
): Promise<{ success: boolean; session?: CheckoutSessionSnapshot; error?: string }> {
  try {
    const session = await recalculateCheckoutSession(checkoutId);
    revalidatePath(`/checkout/${checkoutId}`);
    return { success: true, session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function selectSavedAddressAction(
  checkoutId: string,
  addressId: string,
  type: "shipping" | "billing" | "both" = "both"
): Promise<{ success: boolean; session?: CheckoutSessionSnapshot; error?: string }> {
  try {
    const session = await selectCheckoutSavedAddress(checkoutId, addressId, type);
    revalidatePath(`/checkout/${checkoutId}`);
    return { success: true, session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function saveAndSelectNewAddressAction(
  checkoutId: string,
  input: {
    shippingAddress: Partial<AddressInput>;
    billingAddress?: Partial<AddressInput> | null;
    useShippingAsBilling?: boolean;
  }
): Promise<{ success: boolean; session?: CheckoutSessionSnapshot; error?: string }> {
  try {
    const session = await setCheckoutAddress(checkoutId, input);
    revalidatePath(`/checkout/${checkoutId}`);
    return { success: true, session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateCheckoutContactAction(
  checkoutId: string,
  input: { email: string; phone?: string | null }
): Promise<{ success: boolean; session?: CheckoutSessionSnapshot; error?: string }> {
  try {
    const session = await updateCheckoutContact(checkoutId, input);
    revalidatePath(`/checkout/${checkoutId}`);
    return { success: true, session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function applyCheckoutCouponAction(
  checkoutId: string,
  couponCode: string
): Promise<{ success: boolean; session?: CheckoutSessionSnapshot; error?: string }> {
  try {
    await applyCouponToCart(couponCode);
    const session = await recalculateCheckoutSession(checkoutId);
    revalidatePath(`/checkout/${checkoutId}`);
    return { success: true, session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function removeCheckoutCouponAction(
  checkoutId: string
): Promise<{ success: boolean; session?: CheckoutSessionSnapshot; error?: string }> {
  try {
    await removeCouponFromCart();
    const session = await recalculateCheckoutSession(checkoutId);
    revalidatePath(`/checkout/${checkoutId}`);
    return { success: true, session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

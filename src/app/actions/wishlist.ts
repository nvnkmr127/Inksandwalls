"use server";

import { revalidatePath } from "next/cache";
import { addProductToWishlist, removeProductFromWishlist, checkProductInWishlist } from "@/lib/wishlist/wishlist-service";

export async function toggleWishlistAction(productId: string) {
  try {
    const isWishlisted = await checkProductInWishlist(productId);
    
    if (isWishlisted) {
      await removeProductFromWishlist(productId);
    } else {
      await addProductToWishlist(productId);
    }
    
    revalidatePath("/account/wishlist");
    revalidatePath(`/products`);
    
    return { success: true, isWishlisted: !isWishlisted };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function removeWishlistAction(productId: string) {
  try {
    await removeProductFromWishlist(productId);
    revalidatePath("/account/wishlist");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

import { Metadata } from "next";
import { getCartWithFreshPricing } from "@/lib/cart/cart-service";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "View your selected made-to-order wallpapers and custom prints.",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await getCartWithFreshPricing();

  return <CartView initialCart={cart} />;
}

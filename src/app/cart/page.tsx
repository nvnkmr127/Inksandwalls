import { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "View your selected made-to-order wallpapers and custom prints.",
};

export default function CartPage() {
  return (
    <div className="container max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Shopping Cart
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your items before proceeding to checkout.
        </p>
      </div>

      <EmptyState
        icon={<ShoppingBag className="h-6 w-6" />}
        title="Your cart is currently empty"
        description="Discover our collection of bespoke custom-cut wallpapers, acoustic murals, and framed art prints."
        action={
          <Link href="/products" passHref>
            <Button className="gap-2">
              <span>Explore Catalogue</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
        className="py-16"
      />
    </div>
  );
}

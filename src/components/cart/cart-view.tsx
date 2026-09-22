"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  ArrowRight,
  Ruler,
  Trash2,
  Plus,
  Minus,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatPaiseToRupees } from "@/lib/money";
import {
  updateCartQuantityAction,
  removeCartItemAction,
  clearCartAction,
} from "@/app/actions/cart";
import { notifyCartUpdated } from "@/lib/cart/cart-events";
import type { StorefrontCartView } from "@/lib/cart/cart-service";

interface CartViewProps {
  initialCart: StorefrontCartView;
}

export function CartView({ initialCart }: CartViewProps) {
  const [cart, setCart] = useState<StorefrontCartView>(initialCart);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty < 1 || newQty > 99) return;
    setUpdatingItemId(itemId);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await updateCartQuantityAction(itemId, newQty);
        if (res.success && res.cart) {
          setCart(res.cart);
          notifyCartUpdated(res.cart.totalItems);
        } else {
          setErrorMessage(res.error || "Failed to update item quantity.");
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      } finally {
        setUpdatingItemId(null);
      }
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setUpdatingItemId(itemId);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await removeCartItemAction(itemId);
        if (res.success && res.cart) {
          setCart(res.cart);
          notifyCartUpdated(res.cart.totalItems);
        } else {
          setErrorMessage(res.error || "Failed to remove item.");
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      } finally {
        setUpdatingItemId(null);
      }
    });
  };

  const handleClearCart = () => {
    setIsClearing(true);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await clearCartAction();
        if (res.success && res.cart) {
          setCart(res.cart);
          notifyCartUpdated(0);
        } else {
          setErrorMessage(res.error || "Failed to clear cart.");
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      } finally {
        setIsClearing(false);
      }
    });
  };

  if (cart.items.length === 0) {
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

  const anyPriceChanged = cart.items.some((i) => i.priceChanged);

  return (
    <div className="container max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      {/* Notifications / Warnings */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {cart.hasUnavailableItems && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Some items in your cart are currently out of stock or inactive. Please
            remove them before proceeding.
          </p>
        </div>
      )}

      {anyPriceChanged && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm">
          <Info className="h-5 w-5 shrink-0" />
          <p>
            Pricing for one or more items was updated to reflect current catalog
            rates.
          </p>
        </div>
      )}

      {/* Header with Clear Cart */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Shopping Cart
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cart.totalItems} {cart.totalItems === 1 ? "item" : "items"} in your custom order
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearCart}
          disabled={isClearing || updatingItemId !== null}
          className="text-muted-foreground hover:text-destructive gap-1.5"
        >
          {isClearing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span>Clear Cart</span>
        </Button>
      </div>

      {/* Cart Items List */}
      <div className="space-y-4">
        {cart.items.map((item) => {
          const isPerArea = item.productType === "PER_AREA";
          const isBusy = updatingItemId === item.id || isClearing;

          return (
            <div
              key={item.id}
              className={`flex flex-col sm:flex-row gap-4 p-5 rounded-xl border bg-card shadow-xs transition-colors ${
                !item.isAvailable
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border"
              }`}
            >
              {/* Product Thumbnail */}
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-muted/40">
                {item.primaryMediaKey ? (
                  <OptimizedImage
                    src={item.primaryMediaKey}
                    alt={item.productName}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                )}
              </div>

              {/* Snapshot Content */}
              <div className="flex flex-1 flex-col justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {item.categoryName || (isPerArea ? "Custom Size" : "Wall Art")}
                      </span>
                      <h3 className="font-semibold text-lg text-foreground hover:text-primary">
                        <Link href={`/products/${item.productSlug}`}>
                          {item.productName}
                        </Link>
                      </h3>
                      {!item.isAvailable && (
                        <Badge variant="destructive" className="mt-1">
                          Item Unavailable
                        </Badge>
                      )}
                      {item.priceChanged && (
                        <Badge variant="outline" className="mt-1 text-blue-600 dark:text-blue-400">
                          Price Updated
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-foreground">
                        {formatPaiseToRupees(item.totalPricePaise)}
                      </span>
                      {item.quantity > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatPaiseToRupees(item.unitPricePaise)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Configuration Badges and Snapshot Details */}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {isPerArea && item.dimensions && item.area && (
                      <>
                        <Badge variant="secondary" className="gap-1 font-mono">
                          <Ruler className="h-3 w-3" />
                          {item.dimensions.width} × {item.dimensions.height} {item.dimensions.unit}
                        </Badge>
                        <Badge variant="outline">
                          Billable: {item.area.billableAreaSqft} sq ft
                        </Badge>
                        {item.area.wastagePct > 0 && (
                          <Badge variant="outline" className="text-muted-foreground">
                            +{item.area.wastagePct}% wastage
                          </Badge>
                        )}
                        {item.area.isMinAreaApplied && (
                          <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                            Min floor applied
                          </Badge>
                        )}
                        {item.ratePaise && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Rate: {formatPaiseToRupees(item.ratePaise)}/sqft
                          </Badge>
                        )}
                        {item.area.panelsNeeded && (
                          <Badge variant="outline" className="text-muted-foreground">
                            {item.area.panelsNeeded} {item.area.panelsNeeded === 1 ? "panel" : "panels"}
                          </Badge>
                        )}
                      </>
                    )}

                    {!isPerArea && item.variantName && (
                      <Badge variant="secondary">
                        Variant: {item.variantName}
                      </Badge>
                    )}

                    {!item.returnable && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Custom-Cut (Made-to-Order)
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Controls: Quantity & Remove */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Qty:</span>
                    <div className="flex items-center rounded-lg border border-border bg-background">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-r-none text-muted-foreground hover:text-foreground"
                        disabled={isBusy || item.quantity <= 1}
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        aria-label={`Decrease quantity for ${item.productName}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="flex h-8 w-10 items-center justify-center font-mono text-xs font-semibold text-foreground">
                        {isBusy && updatingItemId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          item.quantity
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-l-none text-muted-foreground hover:text-foreground"
                        disabled={isBusy || item.quantity >= 99}
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        aria-label={`Increase quantity for ${item.productName}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-muted-foreground hover:text-destructive gap-1 text-xs"
                    aria-label={`Remove ${item.productName} from cart`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Summary Card */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-xl border border-border bg-muted/20">
        <div>
          <span className="text-sm text-muted-foreground font-medium">Order Subtotal:</span>
          <p className="text-2xl font-bold text-foreground">
            {formatPaiseToRupees(cart.subtotalPaise)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Taxes & shipping computed at checkout (Phase 07)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/products" passHref>
            <Button variant="outline">Continue Shopping</Button>
          </Link>
          <Button
            disabled={cart.hasUnavailableItems}
            title={
              cart.hasUnavailableItems
                ? "Remove unavailable items to proceed"
                : "Checkout available in Phase 07"
            }
            className="gap-2 opacity-80 cursor-not-allowed"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

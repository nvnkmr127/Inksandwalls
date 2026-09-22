"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { 
  ShoppingCart, 
  X, 
  Ruler,
  Trash2, 
  Plus, 
  Minus, 
  Loader2, 
  ArrowRight,
  ShoppingBag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatPaiseToRupees } from "@/lib/money";
import {
  getCartAction,
  updateCartQuantityAction,
  removeCartItemAction,
} from "@/app/actions/cart";
import { CART_UPDATED_EVENT, notifyCartUpdated, useCartCount } from "@/lib/cart/cart-events";
import type { StorefrontCartView } from "@/lib/cart/cart-service";

export function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState<StorefrontCartView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const cartCount = useCartCount();

  const fetchCart = async () => {
    setIsLoading(true);
    try {
      const data = await getCartAction();
      setCart(data);
    } catch (error) {
      console.error("Failed to load cart", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCart();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleCartEvent = () => {
      if (isOpen) {
        fetchCart();
      }
    };
    window.addEventListener(CART_UPDATED_EVENT, handleCartEvent);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, handleCartEvent);
    };
  }, [isOpen]);

  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty < 1 || newQty > 99) return;
    setUpdatingItemId(itemId);

    startTransition(async () => {
      try {
        const res = await updateCartQuantityAction(itemId, newQty);
        if (res.success && res.cart) {
          setCart(res.cart);
          notifyCartUpdated(res.cart.totalItems);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUpdatingItemId(null);
      }
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setUpdatingItemId(itemId);

    startTransition(async () => {
      try {
        const res = await removeCartItemAction(itemId);
        if (res.success && res.cart) {
          setCart(res.cart);
          notifyCartUpdated(res.cart.totalItems);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUpdatingItemId(null);
      }
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger>
        <Button variant="ghost" size="icon" className="relative group">
          <ShoppingCart className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          {cartCount > 0 && (
            <Badge 
              variant="default" 
              className="absolute -top-1.5 -right-1.5 h-5 min-w-5 flex items-center justify-center px-1 rounded-full text-[10px]"
            >
              {cartCount > 99 ? '99+' : cartCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md p-0 overflow-hidden">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            Shopping Cart
            {cart && cart.totalItems > 0 && (
              <Badge variant="secondary" className="rounded-full">
                {cart.totalItems}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && !cart ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !cart || cart.items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center py-12">
              <div className="rounded-full bg-muted p-4">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Your cart is empty.</p>
              <Button onClick={() => setIsOpen(false)} variant="outline" className="mt-4">
                Continue Shopping
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {cart.items.map((item) => {
                const isPerArea = item.productType === "PER_AREA";
                const isBusy = updatingItemId === item.id;

                return (
                  <div key={item.id} className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted/40 border">
                      {item.primaryMediaKey ? (
                        <OptimizedImage
                          src={item.primaryMediaKey}
                          alt={item.productName}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
                          <ShoppingBag className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-sm line-clamp-2 hover:text-primary">
                            <Link href={`/products/${item.productSlug}`} onClick={() => setIsOpen(false)}>
                              {item.productName}
                            </Link>
                          </h4>
                          {isPerArea && item.dimensions && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                              <Ruler className="h-3 w-3" />
                              {item.dimensions.width} × {item.dimensions.height} {item.dimensions.unit}
                            </div>
                          )}
                          {!isPerArea && item.variantName && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.variantName}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold">
                            {formatPaiseToRupees(item.totalPricePaise)}
                          </span>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center rounded border border-border bg-background">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-r-none text-muted-foreground"
                            disabled={isBusy || item.quantity <= 1}
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="flex h-6 w-8 items-center justify-center font-mono text-xs font-semibold">
                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-l-none text-muted-foreground"
                            disabled={isBusy || item.quantity >= 99}
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isBusy}
                          onClick={() => handleRemoveItem(item.id)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="border-t bg-muted/20 p-6">
            <div className="flex items-center justify-between font-semibold mb-4">
              <span>Subtotal</span>
              <span className="text-lg">{formatPaiseToRupees(cart.subtotalPaise)}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Shipping, taxes, and discounts calculated at checkout.
            </p>
            <div className="flex flex-col gap-3">
              <Button className="w-full gap-2 shadow-sm" disabled={cart.hasUnavailableItems}>
                Checkout
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="w-full h-11" onClick={() => setIsOpen(false)}>
              Start Shopping
            </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

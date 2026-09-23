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
  Edit2,
  Tag,
  Ticket,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatPaiseToRupees } from "@/lib/money";
import {
  updateCartQuantityAction,
  updateCartConfigurationAction,
  removeCartItemAction,
  clearCartAction,
  applyCouponAction,
  removeCouponAction,
} from "@/app/actions/cart";
import { notifyCartUpdated } from "@/lib/cart/cart-events";
import type { StorefrontCartView } from "@/lib/cart/cart-service";
import type { DimensionUnit } from "@/lib/pricing/pricing-engine";

interface CartViewProps {
  initialCart: StorefrontCartView;
}

export function CartView({ initialCart }: CartViewProps) {
  const [cart, setCart] = useState<StorefrontCartView>(initialCart);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isRemovingCoupon, setIsRemovingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    setIsApplyingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);

    startTransition(async () => {
      try {
        const res = await applyCouponAction(couponCodeInput);
        if (res.success && res.cart) {
          setCart(res.cart);
          setCouponSuccess(`Coupon "${couponCodeInput.trim().toUpperCase()}" applied successfully!`);
          setCouponCodeInput("");
        } else {
          setCouponError(res.error || "Failed to apply coupon.");
        }
      } catch (err) {
        setCouponError(err instanceof Error ? err.message : "An unexpected error occurred.");
      } finally {
        setIsApplyingCoupon(false);
      }
    });
  };

  const handleRemoveCoupon = () => {
    setIsRemovingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);

    startTransition(async () => {
      try {
        const res = await removeCouponAction();
        if (res.success && res.cart) {
          setCart(res.cart);
          setCouponSuccess("Coupon removed.");
        } else {
          setCouponError(res.error || "Failed to remove coupon.");
        }
      } catch (err) {
        setCouponError(err instanceof Error ? err.message : "An unexpected error occurred.");
      } finally {
        setIsRemovingCoupon(false);
      }
    });
  };

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

      {checkoutNotice && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 shrink-0" />
            <p>{checkoutNotice}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCheckoutNotice(null)}
            className="text-xs h-7 px-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {cart.couponWarning && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{cart.couponWarning}</p>
        </div>
      )}

      {couponSuccess && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 shrink-0" />
            <p>{couponSuccess}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCouponSuccess(null)}
            className="text-xs h-7 px-2 hover:bg-emerald-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
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
          
          let EditConfigNode = null;
          if (isPerArea && item.dimensions) {
            EditConfigNode = (
              <CartItemEditDialog 
                item={item} 
                isBusy={isBusy} 
                setCart={setCart} 
                setErrorMessage={setErrorMessage} 
                setUpdatingItemId={setUpdatingItemId} 
              />
            );
          }

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
                        {EditConfigNode}
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

      {/* Coupon Application & Order Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Column: Coupon Engine Integration */}
        <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold text-base">
            <Ticket className="h-5 w-5 text-primary" />
            <span>Have a Promotion or Coupon Code?</span>
          </div>

          {cart.coupon ? (
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="font-mono tracking-wider font-semibold">
                    {cart.coupon.code}
                  </Badge>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {cart.coupon.discountType === "PERCENTAGE"
                      ? `${cart.coupon.discountValue}% OFF`
                      : `₹${(cart.coupon.discountValue / 100).toLocaleString("en-IN")} FLAT OFF`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Discount of {formatPaiseToRupees(cart.coupon.discountPaise)} applied to your order.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveCoupon}
                disabled={isRemovingCoupon}
                className="text-xs text-muted-foreground hover:text-destructive h-8 px-2 gap-1"
                aria-label="Remove applied coupon"
              >
                {isRemovingCoupon ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </>
                )}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Enter coupon code (e.g. FESTIVAL10)"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    className="pl-9 font-mono uppercase text-sm"
                    disabled={isApplyingCoupon}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isApplyingCoupon || !couponCodeInput.trim()}
                  className="shrink-0"
                >
                  {isApplyingCoupon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
              {couponError && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{couponError}</span>
                </p>
              )}
            </form>
          )}
        </div>

        {/* Right Column: Order Summary & Checkout Card */}
        <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <h2 className="font-semibold text-base text-foreground">Order Summary</h2>

          <div className="space-y-2 text-sm border-b border-border/60 pb-4">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Cart Subtotal</span>
              <span className="font-medium text-foreground">
                {formatPaiseToRupees(cart.subtotalPaise)}
              </span>
            </div>

            {cart.discountPaise > 0 && (
              <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  <span>Coupon Discount</span>
                </span>
                <span>- {formatPaiseToRupees(cart.discountPaise)}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-muted-foreground text-xs">
              <span>Estimated GST & Delivery</span>
              <span>Calculated at checkout</span>
            </div>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <div>
              <span className="text-base font-bold text-foreground">Total:</span>
              <p className="text-[11px] text-muted-foreground">
                Inclusive of applied promotion discounts
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {formatPaiseToRupees(cart.totalPaise ?? cart.subtotalPaise - (cart.discountPaise || 0))}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              disabled={cart.hasUnavailableItems}
              onClick={() => {
                if (!cart.hasUnavailableItems) {
                  setCheckoutNotice(
                    "Checkout and payment gateway integration will be activated in Micro-Phase 07. All items, configurations, dimensions, and applied coupon discounts are securely preserved."
                  );
                }
              }}
              className="w-full gap-2 shadow-sm h-11 text-base font-medium"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/products" passHref className="w-full">
              <Button variant="outline" className="w-full">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CartItemEditDialogProps {
  item: StorefrontCartView["items"][number];
  isBusy: boolean;
  setCart: React.Dispatch<React.SetStateAction<StorefrontCartView>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setUpdatingItemId: React.Dispatch<React.SetStateAction<string | null>>;
}

function CartItemEditDialog({ item, isBusy, setCart, setErrorMessage, setUpdatingItemId }: CartItemEditDialogProps) {
  const [editWidth, setEditWidth] = useState(String(item.dimensions?.width || ""));
  const [editHeight, setEditHeight] = useState(String(item.dimensions?.height || ""));
  const [editUnit, setEditUnit] = useState<DimensionUnit>((item.dimensions?.unit as DimensionUnit) || "ft");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [, startTransition] = useTransition();

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditOpen(false);
    
    setUpdatingItemId(item.id);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await updateCartConfigurationAction(item.id, {
          width: Number(editWidth),
          height: Number(editHeight),
          unit: editUnit,
        });
        if (res.success && res.cart) {
          setCart(res.cart);
          notifyCartUpdated(res.cart.totalItems);
        } else {
          setErrorMessage(res.error || "Failed to update configuration.");
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

  return (
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogTrigger>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 ml-2">
          <Edit2 className="h-3 w-3" /> Edit Size
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Dimensions for {item.productName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Width</Label>
              <Input type="number" step="0.01" value={editWidth} onChange={(e) => setEditWidth(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Height</Label>
              <Input type="number" step="0.01" value={editHeight} onChange={(e) => setEditHeight(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Select
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value as DimensionUnit)}
              options={[
                { value: "ft", label: "Feet (ft)" },
                { value: "inch", label: "Inches (in)" },
                { value: "cm", label: "Centimeters (cm)" },
                { value: "mm", label: "Millimeters (mm)" },
              ]}
            />
          </div>
          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isBusy}>Update Size</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

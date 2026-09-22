"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  calculatePerAreaPricing,
  calculateFixedPricing,
  validateDimensions,
  ALLOWED_UNITS,
  type DimensionUnit,
} from "@/lib/pricing/pricing-engine";
import { formatPaiseToRupees } from "@/lib/money";
import { addToCartAction } from "@/app/actions/cart";
import { notifyCartUpdated } from "@/lib/cart/cart-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Ruler,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Info,
  Layers,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "cn";

export interface ConfiguratorVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number; // in paise
  isActive: boolean;
  sortOrder: number;
}

export interface ProductConfiguratorProps {
  productId: string;
  productName: string;
  productSlug: string;
  productType: "PER_AREA" | "FIXED";
  basePrice: number | null; // paise
  rate: number | null; // paise
  wastage: number | null; // pct
  minArea: number | null; // sqft
  rollWidth: number | null; // ft
  variants: ConfiguratorVariant[];
  returnable: boolean;
}

export function ProductConfigurator({
  productId,
  productType,
  basePrice,
  rate,
  wastage,
  minArea,
  rollWidth,
  variants,
  returnable,
}: ProductConfiguratorProps) {
  const isPerArea = productType === "PER_AREA";

  // State: Dimensions for PER_AREA
  const [unit, setUnit] = useState<DimensionUnit>("ft");
  const [width, setWidth] = useState<string>("10");
  const [height, setHeight] = useState<string>("8");

  // State: Variant for FIXED
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants.length > 0 ? variants[0].id : ""
  );

  // State: Quantity & Submission
  const [quantity, setQuantity] = useState<number>(1);
  const [isPending, startTransition] = useTransition();
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute live PER_AREA pricing
  const perAreaCalc = useMemo(() => {
    if (!isPerArea || rate == null) return null;

    const numWidth = parseFloat(width);
    const numHeight = parseFloat(height);

    const validation = validateDimensions(numWidth, numHeight, unit);
    if (!validation.isValid || !validation.sanitizedWidth || !validation.sanitizedHeight || !validation.sanitizedUnit) {
      return { isValid: false, error: validation.error || "Invalid dimensions", result: null };
    }

    const result = calculatePerAreaPricing({
      width: validation.sanitizedWidth,
      height: validation.sanitizedHeight,
      unit: validation.sanitizedUnit,
      ratePaise: rate,
      wastagePct: wastage,
      minAreaSqft: minArea,
      rollWidthFt: rollWidth,
      quantity,
    });

    return { isValid: true, error: null, result };
  }, [isPerArea, rate, width, height, unit, wastage, minArea, rollWidth, quantity]);

  // Compute live FIXED pricing
  const fixedCalc = useMemo(() => {
    if (isPerArea) return null;

    const selectedVariant = variants.find((v) => v.id === selectedVariantId);
    const effectiveUnitPrice = selectedVariant ? selectedVariant.price : (basePrice ?? 0);

    return calculateFixedPricing({
      basePricePaise: effectiveUnitPrice,
      quantity,
    });
  }, [isPerArea, variants, selectedVariantId, basePrice, quantity]);

  // Handle quantity adjustment
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.min(99, Math.max(1, prev + delta)));
    setSubmissionSuccess(false);
  };

  // Handle Add to Cart submission
  const handleAddToCart = () => {
    setErrorMessage(null);
    setSubmissionSuccess(false);

    if (isPerArea) {
      if (!perAreaCalc || !perAreaCalc.isValid || !perAreaCalc.result) {
        setErrorMessage(perAreaCalc?.error || "Please provide valid dimensions.");
        return;
      }
    } else {
      if (variants.length > 0 && !selectedVariantId) {
        setErrorMessage("Please select a variant option.");
        return;
      }
    }

    startTransition(async () => {
      const payload = isPerArea
        ? {
            productId,
            productType: "PER_AREA" as const,
            width: parseFloat(width),
            height: parseFloat(height),
            unit,
            quantity,
          }
        : {
            productId,
            productType: "FIXED" as const,
            variantId: selectedVariantId || null,
            quantity,
          };

      const res = await addToCartAction(payload);
      if (res.success) {
        setSubmissionSuccess(true);
        if (typeof res.totalItems === "number") {
          notifyCartUpdated(res.totalItems);
        } else {
          notifyCartUpdated();
        }
      } else {
        setErrorMessage(res.error || "Failed to add product to cart.");
      }
    });
  };

  const currentTotalPricePaise = isPerArea
    ? perAreaCalc?.result?.totalPricePaise ?? 0
    : fixedCalc?.totalPricePaise ?? 0;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
      {/* Configuration Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            {isPerArea ? "Custom Size & Pricing Calculator" : "Select Options"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isPerArea
              ? "Enter your wall measurements for custom made-to-order printing."
              : "Choose your preferred sizing and print finish."}
          </p>
        </div>
        {isPerArea && (
          <Badge variant="secondary" className="gap-1 font-mono text-xs">
            <Ruler className="h-3 w-3" />
            Made-to-Order
          </Badge>
        )}
      </div>

      {/* PER_AREA Dimension Inputs & Unit Selector */}
      {isPerArea && (
        <div className="space-y-4">
          {/* Unit Selector Tabs */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Measurement Unit
            </Label>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Measurement Unit Selector">
              {ALLOWED_UNITS.map((u) => {
                const isSelected = unit === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      setUnit(u);
                      setSubmissionSuccess(false);
                    }}
                    className={cn(
                      "flex items-center justify-center rounded-lg border py-2 text-sm font-medium transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border bg-background hover:bg-muted text-foreground"
                    )}
                  >
                    {u === "ft" ? "Feet (ft)" : u === "inch" ? "Inches (in)" : u === "cm" ? "Centimeters (cm)" : "Millimeters (mm)"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Width & Height Number Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dim-width" className="text-xs font-medium text-foreground">
                Wall Width ({unit})
              </Label>
              <Input
                id="dim-width"
                type="number"
                step="any"
                min="0.1"
                placeholder="10"
                value={width}
                onChange={(e) => {
                  setWidth(e.target.value);
                  setSubmissionSuccess(false);
                }}
                className="font-mono text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dim-height" className="text-xs font-medium text-foreground">
                Wall Height ({unit})
              </Label>
              <Input
                id="dim-height"
                type="number"
                step="any"
                min="0.1"
                placeholder="8"
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value);
                  setSubmissionSuccess(false);
                }}
                className="font-mono text-base"
              />
            </div>
          </div>

          {/* Dimension Error Notice if Invalid */}
          {perAreaCalc && !perAreaCalc.isValid && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{perAreaCalc.error}</span>
            </div>
          )}

          {/* Transparent Calculation Breakdown Card */}
          {perAreaCalc?.result && (
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/50 pb-2">
                <span className="font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Calculation Breakdown
                </span>
                <span>Base Rate: {formatPaiseToRupees(perAreaCalc.result.ratePaise)} / sq ft</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Entered Area</span>
                  <span className="font-semibold text-foreground">
                    {perAreaCalc.result.enteredAreaSqft} sq ft
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block">
                    Wastage ({perAreaCalc.result.wastagePct}%)
                  </span>
                  <span className="font-semibold text-foreground">
                    +{perAreaCalc.result.wastageAreaSqft} sq ft
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block">Billable Area</span>
                  <span className="font-semibold text-foreground">
                    {perAreaCalc.result.billableAreaSqft} sq ft
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block">Unit Price</span>
                  <span className="font-semibold text-primary">
                    {formatPaiseToRupees(perAreaCalc.result.unitPricePaise)}
                  </span>
                </div>
              </div>

              {/* Minimum Area Floor Notice */}
              {perAreaCalc.result.isMinAreaApplied && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Minimum billable area applied:</strong> The product requires a minimum order floor of {perAreaCalc.result.minAreaSqft} sq ft.
                  </span>
                </div>
              )}

              {/* Wallpaper Roll Panel Notice */}
              {perAreaCalc.result.panelsNeeded != null && (
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Standard roll width: {perAreaCalc.result.rollWidthFt} ft</span>
                  <span className="font-medium text-foreground">
                    Estimated panels: {perAreaCalc.result.panelsNeeded} drops
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FIXED Variant Selector */}
      {!isPerArea && variants.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Select Variant
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Product Variants">
            {variants.map((variant) => {
              const isSelected = selectedVariantId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelectedVariantId(variant.id);
                    setSubmissionSuccess(false);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 text-left transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-2xs"
                      : "border-border bg-background hover:bg-muted/50"
                  )}
                >
                  <span className="font-medium text-sm text-foreground">{variant.name}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatPaiseToRupees(variant.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity Selector & Live Total Section */}
      <div className="border-t border-border pt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <Label htmlFor="product-qty" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quantity:
            </Label>
            <div className="flex items-center rounded-lg border border-border bg-background shadow-2xs">
              <button
                type="button"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1 || isPending}
                aria-label="Decrease quantity"
                className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>

              <span
                id="product-qty"
                className="w-10 text-center text-sm font-semibold text-foreground select-none"
              >
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= 99 || isPending}
                aria-label="Increase quantity"
                className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Authoritative Live Price Display */}
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Total Estimated Price</span>
            <div
              className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
              aria-live="polite"
            >
              {formatPaiseToRupees(currentTotalPricePaise)}
            </div>
          </div>
        </div>

        {/* Feedback / Error Messages */}
        {errorMessage && (
          <div
            className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {submissionSuccess && (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300"
            role="status"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Added to your cart successfully!</span>
            </div>
            <Link href="/cart" passHref>
              <Button size="sm" variant="outline" className="gap-1.5 border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">
                <span>View Cart</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {/* Add to Cart Action Button */}
        <Button
          type="button"
          onClick={handleAddToCart}
          disabled={isPending || (isPerArea && !perAreaCalc?.isValid)}
          className="w-full h-12 text-base font-semibold gap-2 shadow-sm"
        >
          {isPending ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Adding to Cart...</span>
            </div>
          ) : (
            <>
              <ShoppingBag className="h-5 w-5" />
              <span>Add to Cart</span>
            </>
          )}
        </Button>

        {/* Return Policy Notice */}
        <div className="text-center">
          <span className="text-xs text-muted-foreground">
            {!returnable
              ? "Notice: Custom-cut made-to-order items are non-returnable once printed."
              : "Standard 7-day return policy applies to stocked wall art."}
          </span>
        </div>
      </div>
    </div>
  );
}

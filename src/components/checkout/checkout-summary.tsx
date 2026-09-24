"use client";

import React, { useState, useTransition } from "react";
import { formatPaiseToRupees } from "@/lib/money";
import type { CheckoutSessionSnapshot } from "@/lib/checkout/checkout-service";
import {
  applyCheckoutCouponAction,
  removeCheckoutCouponAction,
} from "@/app/actions/checkout";
import { Tag, Truck, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

export interface CheckoutSummaryProps {
  session: CheckoutSessionSnapshot;
  onSessionUpdated?: (newSession: CheckoutSessionSnapshot) => void;
  isRecalculating?: boolean;
}

export function CheckoutSummary({
  session,
  onSessionUpdated,
  isRecalculating = false,
}: CheckoutSummaryProps) {
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totals = session.totals;
  const items = session.cart.items || [];
  const loading = isRecalculating || isPending;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setCouponError(null);
    startTransition(async () => {
      const res = await applyCheckoutCouponAction(session.id, couponInput.trim());
      if (res.success && res.session) {
        setCouponInput("");
        onSessionUpdated?.(res.session);
      } else {
        setCouponError(res.error || "Failed to apply coupon.");
      }
    });
  };

  const handleRemoveCoupon = () => {
    setCouponError(null);
    startTransition(async () => {
      const res = await removeCheckoutCouponAction(session.id);
      if (res.success && res.session) {
        onSessionUpdated?.(res.session);
      } else {
        setCouponError(res.error || "Failed to remove coupon.");
      }
    });
  };

  return (
    <aside
      aria-label="Order Summary"
      className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200/80 shadow-sm relative overflow-hidden"
    >
      {/* Loading Overlay */}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10 rounded-2xl transition-all"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 bg-white px-4 py-2 rounded-full shadow-md border border-neutral-200">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
            <span>Updating order totals...</span>
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold tracking-tight text-neutral-900 mb-5 flex items-center justify-between">
        <span>Order Summary</span>
        <span className="text-sm font-normal text-neutral-500">
          {totals.itemCount} {totals.itemCount === 1 ? "item" : "items"}
        </span>
      </h2>

      {/* Cart Items List */}
      <div className="divide-y divide-neutral-200/60 max-h-64 overflow-y-auto mb-6 pr-1">
        {items.map((item) => (
          <div key={item.id} className="py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">
                {item.productName}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {item.productType === "PER_AREA" && item.width && item.height
                  ? `${item.width} × ${item.height} ${item.unit || "ft"}`
                  : item.variantName || "Standard"}
                {" · "}Qty {item.quantity}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-neutral-900">
                {formatPaiseToRupees(item.totalPricePaise)}
              </p>
              {item.quantity > 1 && (
                <p className="text-[11px] text-neutral-400">
                  {formatPaiseToRupees(item.unitPricePaise)} each
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Free Shipping Incentive Banner */}
      {totals.freeShippingThresholdPaise && (
        <div className="mb-6 p-3 rounded-xl bg-white border border-neutral-200/90 shadow-2xs">
          {totals.isFreeShipping ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>You unlocked FREE Standard Delivery!</span>
            </div>
          ) : totals.amountRemainingForFreeShippingPaise && totals.amountRemainingForFreeShippingPaise > 0 ? (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-700 mb-1.5 font-medium">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Free delivery threshold</span>
                </span>
                <span className="font-semibold text-neutral-900">
                  Add {formatPaiseToRupees(totals.amountRemainingForFreeShippingPaise)}
                </span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-neutral-900 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        5,
                        ((totals.freeShippingThresholdPaise - totals.amountRemainingForFreeShippingPaise) /
                          totals.freeShippingThresholdPaise) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Coupon Application / Active Badge */}
      <div className="mb-6">
        {totals.couponCode ? (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold">{totals.couponCode}</span>
              <span className="text-emerald-700">
                (-{formatPaiseToRupees(totals.couponDiscountPaise)})
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              disabled={loading}
              className="p-1 text-emerald-700 hover:text-emerald-950 rounded-md transition-colors"
              aria-label="Remove coupon"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              disabled={loading}
              className="flex-1 bg-white px-3 py-2 text-xs font-mono tracking-wider border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 uppercase placeholder:normal-case placeholder:font-sans"
            />
            <button
              type="submit"
              disabled={loading || !couponInput.trim()}
              className="px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              Apply
            </button>
          </form>
        )}

        {/* Coupon Warning / Error */}
        {(couponError || totals.couponWarning) && (
          <p className="text-xs text-amber-700 mt-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>{couponError || totals.couponWarning}</span>
          </p>
        )}
      </div>

      {/* Financial Line Breakdown */}
      <div className="space-y-3 pt-4 border-t border-neutral-200/80 text-sm">
        {/* Cart Subtotal */}
        <div className="flex justify-between text-neutral-600">
          <span>Subtotal</span>
          <span className="font-medium text-neutral-900">
            {formatPaiseToRupees(totals.subtotalPaise)}
          </span>
        </div>

        {/* Coupon Discount */}
        {totals.couponDiscountPaise > 0 && (
          <div className="flex justify-between text-emerald-700 font-medium">
            <span>Coupon Discount</span>
            <span>-{formatPaiseToRupees(totals.couponDiscountPaise)}</span>
          </div>
        )}

        {/* Shipping Cost */}
        <div className="flex justify-between text-neutral-600">
          <span className="flex items-center gap-1">
            <span>Shipping</span>
            {totals.appliedShippingRule && (
              <span className="text-[11px] text-neutral-400">
                ({totals.appliedShippingRule.name})
              </span>
            )}
          </span>
          {totals.deliveryStatus === "PENDING_ADDRESS" ? (
            <span className="text-xs text-neutral-500 italic">
              Calculated at address step
            </span>
          ) : totals.deliveryStatus === "UNDELIVERABLE" ? (
            <span className="text-xs font-semibold text-rose-600">
              Not Deliverable
            </span>
          ) : totals.isFreeShipping || totals.shippingPaise === 0 ? (
            <span className="font-semibold text-emerald-700">FREE</span>
          ) : (
            <span className="font-medium text-neutral-900">
              {formatPaiseToRupees(totals.shippingPaise)}
            </span>
          )}
        </div>

        {/* Deliverability Alert if Undeliverable */}
        {totals.deliveryStatus === "UNDELIVERABLE" && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{totals.deliveryError || "Selected address is outside our delivery zone."}</span>
          </div>
        )}

        {/* Total (Before Tax) */}
        <div className="pt-4 border-t border-neutral-200 flex justify-between items-baseline">
          <div>
            <p className="text-base font-bold text-neutral-900">Total Payable</p>
            <p className="text-[11px] text-neutral-500">
              Excluding taxes (calculated at checkout)
            </p>
          </div>
          <p className="text-xl font-bold tracking-tight text-neutral-900">
            {formatPaiseToRupees(totals.totalPayablePaise)}
          </p>
        </div>
      </div>
    </aside>
  );
}

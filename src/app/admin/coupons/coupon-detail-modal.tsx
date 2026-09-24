"use client";

import * as React from "react";
import { DiscountType } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPaiseToRupees } from "@/lib/money";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Calendar, Tag, User, ShoppingBag, ShieldCheck } from "lucide-react";

interface UsageRecord {
  id: string;
  cartId: string | null;
  usedAt: string;
  customer?: {
    user?: {
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
  } | null;
}

export interface CouponDetailData {
  id: string;
  code: string;
  discountType: DiscountType | string;
  discountValue: number;
  minCartValuePaise?: number | null;
  maxDiscountPaise?: number | null;
  startDate?: string | null;
  expiryDate?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  currentUsageCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usages?: UsageRecord[];
  _count?: {
    usages: number;
    carts: number;
  };
}

interface CouponDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  couponId?: string | null;
}

export function CouponDetailModal({
  open,
  onOpenChange,
  couponId,
}: CouponDetailModalProps) {
  const [coupon, setCoupon] = React.useState<CouponDetailData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !couponId) {
      return;
    }

    let cancelled = false;

    async function fetchDetails() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/admin/coupons/${couponId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErrorMessage(data.error?.message || "Failed to load coupon details.");
          return;
        }
        setCoupon(data);
      } catch {
        if (!cancelled) {
          setErrorMessage("Network error occurred while fetching coupon details.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [open, couponId]);

  const now = new Date();
  const isExpired = coupon?.expiryDate ? new Date(coupon.expiryDate) < now : false;
  const isUpcoming = coupon?.startDate ? new Date(coupon.startDate) > now : false;
  const isDepleted =
    coupon?.usageLimit != null && coupon.currentUsageCount >= coupon.usageLimit;

  const maskIdentifier = (str: string | null | undefined) => {
    if (!str) return "Guest Customer";
    if (str.includes("@")) {
      const [name, domain] = str.split("@");
      return `${name.slice(0, 2)}***@${domain}`;
    }
    if (str.length >= 8) {
      return `${str.slice(0, 3)}****${str.slice(-3)}`;
    }
    return str;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <span>Coupon Overview</span>
            </DialogTitle>
            {coupon && (
              <div>
                {!coupon.isActive ? (
                  <Badge variant="outline" className="border-muted text-muted-foreground bg-muted/30">
                    Inactive
                  </Badge>
                ) : isExpired ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10">
                    Expired
                  </Badge>
                ) : isUpcoming ? (
                  <Badge variant="outline" className="border-blue-500/40 text-blue-500 bg-blue-500/10">
                    Upcoming
                  </Badge>
                ) : isDepleted ? (
                  <Badge variant="outline" className="border-rose-500/40 text-rose-600 bg-rose-500/10">
                    Limit Reached
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
                    Active
                  </Badge>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12">
            <LoadingState title="Loading coupon details..." />
          </div>
        ) : errorMessage ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {errorMessage}
          </div>
        ) : coupon ? (
          <div className="space-y-6 py-2">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-muted/10 gap-3">
              <div>
                <span className="text-xs uppercase font-medium text-muted-foreground tracking-wider">
                  Coupon Code
                </span>
                <div className="font-mono text-2xl font-bold text-foreground tracking-wider">
                  {coupon.code}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs uppercase font-medium text-muted-foreground tracking-wider">
                  Discount Rule
                </span>
                <div className="text-lg font-semibold text-primary">
                  {coupon.discountType === DiscountType.PERCENTAGE
                    ? `${coupon.discountValue}% OFF`
                    : `${formatPaiseToRupees(coupon.discountValue)} OFF`}
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Total Redemptions
                </span>
                <div className="text-xl font-bold text-foreground">
                  {coupon.currentUsageCount}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-xs text-muted-foreground">Global Limit</span>
                <div className="text-xl font-bold text-foreground">
                  {coupon.usageLimit != null ? coupon.usageLimit : "Unlimited"}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-xs text-muted-foreground">Per-Customer</span>
                <div className="text-xl font-bold text-foreground">
                  {coupon.perCustomerLimit != null
                    ? `${coupon.perCustomerLimit}x`
                    : "Unlimited"}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-xs text-muted-foreground">Remaining</span>
                <div className="text-xl font-bold text-foreground">
                  {coupon.usageLimit != null
                    ? Math.max(0, coupon.usageLimit - coupon.currentUsageCount)
                    : "Unlimited"}
                </div>
              </div>
            </div>

            {/* Rules and Limits breakdown */}
            <div className="rounded-lg border border-border divide-y divide-border text-sm">
              <div className="flex items-center justify-between p-3">
                <span className="text-muted-foreground">Minimum Cart Subtotal</span>
                <span className="font-medium text-foreground">
                  {coupon.minCartValuePaise
                    ? formatPaiseToRupees(coupon.minCartValuePaise)
                    : "None (No minimum requirement)"}
                </span>
              </div>

              {coupon.discountType === DiscountType.PERCENTAGE && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-muted-foreground">Maximum Discount Cap</span>
                  <span className="font-medium text-foreground">
                    {coupon.maxDiscountPaise
                      ? formatPaiseToRupees(coupon.maxDiscountPaise)
                      : "Uncapped"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between p-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Start Date
                </span>
                <span className="font-medium text-foreground">
                  {coupon.startDate
                    ? new Date(coupon.startDate).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Immediate"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Expiry Date
                </span>
                <span className="font-medium text-foreground">
                  {coupon.expiryDate
                    ? new Date(coupon.expiryDate).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Never expires"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3">
                <span className="text-muted-foreground">Created / Updated</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(coupon.createdAt).toLocaleDateString()} /{" "}
                  {new Date(coupon.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Redemptions Log */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" /> Recent Redemptions ({coupon.usages?.length || 0})
                </h4>
              </div>

              {coupon.usages && coupon.usages.length > 0 ? (
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Date & Time</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">Cart / Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {coupon.usages.map((u) => {
                        const custName = u.customer?.user?.name;
                        const custContact =
                          u.customer?.user?.email || u.customer?.user?.phone;
                        return (
                          <tr key={u.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {new Date(u.usedAt).toLocaleString("en-IN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span>{custName || maskIdentifier(custContact)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-muted-foreground truncate max-w-xs">
                              {u.cartId || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No redemptions yet"
                  description="This coupon has not been used in any customer carts or orders."
                />
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

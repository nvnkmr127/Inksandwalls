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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/feedback/toast";
import { normalizeCouponCode } from "@/lib/coupons/coupon-engine";

export interface CouponItemData {
  id?: string;
  code: string;
  discountType: DiscountType | string;
  discountValue: number;
  minCartValuePaise?: number | null;
  maxDiscountPaise?: number | null;
  startDate?: string | Date | null;
  expiryDate?: string | Date | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  currentUsageCount?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CouponFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: CouponItemData | null;
  onSuccess: () => void;
}

function formatDateForInput(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  // Format to YYYY-MM-DDTHH:mm
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CouponFormModal({
  open,
  onOpenChange,
  coupon,
  onSuccess,
}: CouponFormModalProps) {
  const isEditing = Boolean(coupon?.id);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form states
  const [code, setCode] = React.useState("");
  const [discountType, setDiscountType] = React.useState<DiscountType>(DiscountType.PERCENTAGE);
  const [discountValue, setDiscountValue] = React.useState<string>("");
  const [minCartValueRupees, setMinCartValueRupees] = React.useState<string>("");
  const [maxDiscountRupees, setMaxDiscountRupees] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState<string>("");
  const [expiryDate, setExpiryDate] = React.useState<string>("");
  const [usageLimit, setUsageLimit] = React.useState<string>("");
  const [perCustomerLimit, setPerCustomerLimit] = React.useState<string>("");
  const [isActive, setIsActive] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevCoupon, setPrevCoupon] = React.useState(coupon);

  if (open !== prevOpen || coupon !== prevCoupon) {
    setPrevOpen(open);
    setPrevCoupon(coupon);
    if (open) {
      if (coupon) {
        setCode(coupon.code || "");
        setDiscountType((coupon.discountType as DiscountType) || DiscountType.PERCENTAGE);
        // For PERCENTAGE: discountValue is raw percent (e.g. 10). For FIXED: discountValue is paise, so divide by 100 for rupees
        if (coupon.discountType === DiscountType.FIXED_AMOUNT) {
          setDiscountValue(String(coupon.discountValue / 100));
        } else {
          setDiscountValue(String(coupon.discountValue));
        }
        setMinCartValueRupees(
          coupon.minCartValuePaise ? String(coupon.minCartValuePaise / 100) : ""
        );
        setMaxDiscountRupees(
          coupon.maxDiscountPaise ? String(coupon.maxDiscountPaise / 100) : ""
        );
        setStartDate(formatDateForInput(coupon.startDate));
        setExpiryDate(formatDateForInput(coupon.expiryDate));
        setUsageLimit(coupon.usageLimit != null ? String(coupon.usageLimit) : "");
        setPerCustomerLimit(
          coupon.perCustomerLimit != null ? String(coupon.perCustomerLimit) : ""
        );
        setIsActive(coupon.isActive ?? true);
      } else {
        setCode("");
        setDiscountType(DiscountType.PERCENTAGE);
        setDiscountValue("");
        setMinCartValueRupees("");
        setMaxDiscountRupees("");
        setStartDate("");
        setExpiryDate("");
        setUsageLimit("");
        setPerCustomerLimit("");
        setIsActive(true);
      }
      setErrors({});
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    setCode(rawVal);
    if (errors.code) {
      setErrors((prev) => ({ ...prev, code: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const normalizedCode = normalizeCouponCode(code);

    if (!normalizedCode) {
      newErrors.code = "Coupon code is required.";
    } else if (!/^[A-Z0-9_-]{2,32}$/.test(normalizedCode)) {
      newErrors.code = "Coupon code must be 2-32 uppercase alphanumeric characters.";
    }

    const numDiscountValue = Number(discountValue);
    if (!discountValue || isNaN(numDiscountValue) || numDiscountValue <= 0) {
      newErrors.discountValue = "Valid discount value is required.";
    } else if (discountType === DiscountType.PERCENTAGE && (numDiscountValue < 1 || numDiscountValue > 100)) {
      newErrors.discountValue = "Percentage must be between 1% and 100%.";
    }

    if (minCartValueRupees) {
      const minVal = Number(minCartValueRupees);
      if (isNaN(minVal) || minVal < 0) {
        newErrors.minCartValueRupees = "Minimum cart value must be 0 or greater.";
      }
    }

    if (maxDiscountRupees && discountType === DiscountType.PERCENTAGE) {
      const maxVal = Number(maxDiscountRupees);
      if (isNaN(maxVal) || maxVal <= 0) {
        newErrors.maxDiscountRupees = "Maximum discount cap must be greater than 0.";
      }
    }

    if (startDate && expiryDate) {
      const start = new Date(startDate).getTime();
      const expiry = new Date(expiryDate).getTime();
      if (expiry <= start) {
        newErrors.expiryDate = "Expiry date must be after the start date.";
      }
    }

    if (usageLimit) {
      const limit = Number(usageLimit);
      if (isNaN(limit) || !Number.isInteger(limit) || limit < 1) {
        newErrors.usageLimit = "Usage limit must be a positive integer.";
      }
    }

    if (perCustomerLimit) {
      const custLimit = Number(perCustomerLimit);
      if (isNaN(custLimit) || !Number.isInteger(custLimit) || custLimit < 1) {
        newErrors.perCustomerLimit = "Per-customer limit must be a positive integer.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate minor units (paise) for storage
      const finalDiscountValue =
        discountType === DiscountType.FIXED_AMOUNT
          ? Math.round(Number(discountValue) * 100)
          : Math.round(Number(discountValue));

      const payload = {
        code: normalizedCode,
        discountType,
        discountValue: finalDiscountValue,
        minCartValuePaise: minCartValueRupees
          ? Math.round(Number(minCartValueRupees) * 100)
          : null,
        maxDiscountPaise:
          maxDiscountRupees && discountType === DiscountType.PERCENTAGE
            ? Math.round(Number(maxDiscountRupees) * 100)
            : null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null,
        isActive,
      };

      const url = isEditing
        ? `/api/admin/coupons/${coupon!.id}`
        : "/api/admin/coupons";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error?.message || "Failed to save coupon";
        if (errorMsg.toLowerCase().includes("code")) {
          setErrors({ code: errorMsg });
        }
        toast.error(isEditing ? "Update Failed" : "Create Failed", errorMsg);
        return;
      }

      toast.success(
        isEditing ? "Coupon Updated" : "Coupon Created",
        `Coupon '${payload.code}' saved successfully.`
      );
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Error", "An unexpected network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!isSubmitting} className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Coupon" : "Create New Coupon"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Coupon Code & Discount Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Coupon Code"
              required
              description="Uppercase alphanumeric identifier (e.g. FESTIVE20)"
              error={errors.code}
            >
              <Input
                id="coupon-code"
                placeholder="e.g. FESTIVE20"
                value={code}
                onChange={handleCodeChange}
                disabled={isSubmitting}
                className="font-mono uppercase font-semibold tracking-wider"
              />
            </FormField>

            <FormField label="Discount Type" required>
              <Select
                id="coupon-discount-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                disabled={isSubmitting}
              >
                <option value={DiscountType.PERCENTAGE}>Percentage (%)</option>
                <option value={DiscountType.FIXED_AMOUNT}>Fixed Amount (₹)</option>
              </Select>
            </FormField>
          </div>

          {/* Discount Value & Max Discount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label={discountType === DiscountType.PERCENTAGE ? "Discount Percentage (%)" : "Discount Amount (₹)"}
              required
              description={
                discountType === DiscountType.PERCENTAGE
                  ? "Enter a value between 1 and 100"
                  : "Enter discount amount in Rupees"
              }
              error={errors.discountValue}
            >
              <Input
                id="coupon-discount-value"
                type="number"
                step={discountType === DiscountType.PERCENTAGE ? "1" : "0.01"}
                min={discountType === DiscountType.PERCENTAGE ? "1" : "0.01"}
                max={discountType === DiscountType.PERCENTAGE ? "100" : undefined}
                placeholder={discountType === DiscountType.PERCENTAGE ? "e.g. 15" : "e.g. 500"}
                value={discountValue}
                onChange={(e) => {
                  setDiscountValue(e.target.value);
                  if (errors.discountValue) setErrors((prev) => ({ ...prev, discountValue: "" }));
                }}
                disabled={isSubmitting}
              />
            </FormField>

            {discountType === DiscountType.PERCENTAGE ? (
              <FormField
                label="Maximum Discount Cap (₹)"
                description="Optional maximum discount ceiling in Rupees"
                error={errors.maxDiscountRupees}
              >
                <Input
                  id="coupon-max-discount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 1000 (No cap if empty)"
                  value={maxDiscountRupees}
                  onChange={(e) => {
                    setMaxDiscountRupees(e.target.value);
                    if (errors.maxDiscountRupees) setErrors((prev) => ({ ...prev, maxDiscountRupees: "" }));
                  }}
                  disabled={isSubmitting}
                />
              </FormField>
            ) : (
              <FormField
                label="Minimum Cart Value (₹)"
                description="Minimum cart subtotal to qualify in Rupees"
                error={errors.minCartValueRupees}
              >
                <Input
                  id="coupon-min-cart-fixed"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 999 (None if empty)"
                  value={minCartValueRupees}
                  onChange={(e) => {
                    setMinCartValueRupees(e.target.value);
                    if (errors.minCartValueRupees) setErrors((prev) => ({ ...prev, minCartValueRupees: "" }));
                  }}
                  disabled={isSubmitting}
                />
              </FormField>
            )}
          </div>

          {/* Min Cart Value for PERCENTAGE */}
          {discountType === DiscountType.PERCENTAGE && (
            <FormField
              label="Minimum Cart Value (₹)"
              description="Minimum cart subtotal required to apply this coupon"
              error={errors.minCartValueRupees}
            >
              <Input
                id="coupon-min-cart-percent"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1500 (No minimum if empty)"
                value={minCartValueRupees}
                onChange={(e) => {
                  setMinCartValueRupees(e.target.value);
                  if (errors.minCartValueRupees) setErrors((prev) => ({ ...prev, minCartValueRupees: "" }));
                }}
                disabled={isSubmitting}
              />
            </FormField>
          )}

          {/* Validity Period: Start Date & Expiry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Start Date & Time" description="Coupon becomes active at this time">
              <Input
                id="coupon-start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              label="Expiry Date & Time"
              description="Coupon expires after this time"
              error={errors.expiryDate}
            >
              <Input
                id="coupon-expiry-date"
                type="datetime-local"
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  if (errors.expiryDate) setErrors((prev) => ({ ...prev, expiryDate: "" }));
                }}
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          {/* Usage Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Global Usage Limit"
              description="Max total redemptions across all shoppers"
              error={errors.usageLimit}
            >
              <Input
                id="coupon-usage-limit"
                type="number"
                min="1"
                step="1"
                placeholder="Unlimited if empty"
                value={usageLimit}
                onChange={(e) => {
                  setUsageLimit(e.target.value);
                  if (errors.usageLimit) setErrors((prev) => ({ ...prev, usageLimit: "" }));
                }}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              label="Per-Customer Limit"
              description="Max redemptions per authenticated customer"
              error={errors.perCustomerLimit}
            >
              <Input
                id="coupon-per-customer-limit"
                type="number"
                min="1"
                step="1"
                placeholder="Unlimited if empty"
                value={perCustomerLimit}
                onChange={(e) => {
                  setPerCustomerLimit(e.target.value);
                  if (errors.perCustomerLimit) setErrors((prev) => ({ ...prev, perCustomerLimit: "" }));
                }}
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          {/* Active Status Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
            <div className="space-y-0.5">
              <Label htmlFor="coupon-active-switch" className="text-sm font-semibold">
                Coupon Status
              </Label>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? "Active — eligible shoppers can apply this coupon."
                  : "Inactive — immediate kill switch preventing any applications."}
              </p>
            </div>
            <Switch
              id="coupon-active-switch"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {isEditing ? "Save Changes" : "Create Coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

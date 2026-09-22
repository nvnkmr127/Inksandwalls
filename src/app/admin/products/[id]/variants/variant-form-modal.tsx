"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/feedback/toast";
import type { VariantItem } from "./variants-data-table";

interface VariantFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  variant?: VariantItem | null;
  onSuccess: () => void;
}

export function VariantFormModal({
  open,
  onOpenChange,
  productId,
  variant,
  onSuccess,
}: VariantFormModalProps) {
  const isEditing = Boolean(variant?.id);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form field state
  const [name, setName] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [priceRupees, setPriceRupees] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [sortOrder, setSortOrder] = React.useState("0");

  // Inline error state
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevVariant, setPrevVariant] = React.useState(variant);

  // Sync form state when modal opens or target variant changes
  if (open !== prevOpen || variant !== prevVariant) {
    setPrevOpen(open);
    setPrevVariant(variant);
    if (open) {
      setErrors({});
      if (variant) {
        setName(variant.name || "");
        setSku(variant.sku || "");
        setPriceRupees(variant.price != null ? (variant.price / 100).toString() : "");
        setIsActive(variant.isActive !== undefined ? variant.isActive : true);
        setSortOrder(variant.sortOrder != null ? variant.sortOrder.toString() : "0");
      } else {
        setName("");
        setSku("");
        setPriceRupees("");
        setIsActive(true);
        setSortOrder("0");
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Variant name is required.";
    }

    if (sku.trim() && !/^[a-zA-Z0-9_\-]+$/.test(sku.trim())) {
      newErrors.sku = "SKU can only contain letters, numbers, hyphens, and underscores.";
    }

    const parsedPrice = parseFloat(priceRupees);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      newErrors.price = "Price must be a valid number greater than zero.";
    }

    const parsedSort = parseInt(sortOrder, 10);
    if (isNaN(parsedSort)) {
      newErrors.sortOrder = "Sort order must be an integer.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const priceInPaise = Math.round(parsedPrice * 100);

      const payload = {
        name: name.trim(),
        sku: sku.trim() || null,
        price: priceInPaise,
        isActive,
        sortOrder: parsedSort,
      };

      const url = isEditing
        ? `/api/admin/products/${productId}/variants/${variant?.id}`
        : `/api/admin/products/${productId}/variants`;

      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error?.message || "Failed to save variant.";
        toast.error(isEditing ? "Update Failed" : "Create Failed", errorMsg);
        if (errorMsg.toLowerCase().includes("sku")) {
          setErrors((prev) => ({ ...prev, sku: errorMsg }));
        }
        return;
      }

      toast.success(
        isEditing ? "Variant Updated" : "Variant Created",
        `Product variant '${data.name}' has been ${isEditing ? "updated" : "created"} successfully.`
      );

      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Error", "An unexpected error occurred while saving the variant.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Variant" : "Add Variant"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Variant Name */}
          <FormField
            label="Variant Name"
            htmlFor="variant-name"
            required
            error={errors.name}
            description="e.g. Black Frame, 30 × 40 cm, Premium Finish"
          >
            <Input
              id="variant-name"
              placeholder="e.g. 30 × 40 cm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          {/* SKU */}
          <FormField
            label="SKU (Stock Keeping Unit)"
            htmlFor="variant-sku"
            error={errors.sku}
            description="Optional unique identifier (e.g. WALLART-30X40-BLK)"
          >
            <Input
              id="variant-sku"
              placeholder="e.g. WALLART-30X40-BLK"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          {/* Price (Rupees) */}
          <FormField
            label="Price (₹)"
            htmlFor="variant-price"
            required
            error={errors.price}
            description="Fixed price for this variant in Indian Rupees (₹)"
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                ₹
              </span>
              <Input
                id="variant-price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="4999.00"
                className="pl-7"
                value={priceRupees}
                onChange={(e) => setPriceRupees(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </FormField>

          {/* Sort Order */}
          <FormField
            label="Sort Order"
            htmlFor="variant-sort"
            error={errors.sortOrder}
            description="Display order priority (lower numbers appear first)"
          >
            <Input
              id="variant-sort"
              type="number"
              step="1"
              placeholder="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          {/* Active Switch */}
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-xs">
            <div className="space-y-0.5">
              <Label htmlFor="variant-active" className="text-sm font-medium">
                Active Status
              </Label>
              <p className="text-xs text-muted-foreground">
                Active variants will be visible for future storefront selection.
              </p>
            </div>
            <Switch
              id="variant-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                ? "Save Changes"
                : "Add Variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

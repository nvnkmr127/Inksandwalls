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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/feedback/toast";
import { generateSlug } from "@/lib/products/slug";
import type { ProductItem } from "./products-data-table";

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductItem | null;
  onSuccess: () => void;
}

export function ProductFormModal({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ProductFormModalProps) {
  const isEditing = Boolean(product?.id);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(false);

  // Form states
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [productType, setProductType] = React.useState<"PER_AREA" | "FIXED">("PER_AREA");
  const [categoryId, setCategoryId] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [returnable, setReturnable] = React.useState(true);
  const [hsnCode, setHsnCode] = React.useState("");

  // Pricing inputs in user-facing units (Rupees ₹)
  const [priceRupees, setPriceRupees] = React.useState("");
  const [rateRupees, setRateRupees] = React.useState("");
  const [wastagePct, setWastagePct] = React.useState("0");
  const [minAreaSqft, setMinAreaSqft] = React.useState("");
  const [rollWidthFt, setRollWidthFt] = React.useState("");

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevProduct, setPrevProduct] = React.useState(product);

  // Load available categories when modal opens
  React.useEffect(() => {
    if (!open) return;

    async function loadCategories() {
      setIsLoadingCategories(true);
      try {
        const res = await fetch("/api/admin/categories?status=active&pageSize=100");
        const data = await res.json();
        if (res.ok) {
          setCategories(data.items || []);
        }
      } catch {
        toast.error("Error", "Failed to load category list.");
      } finally {
        setIsLoadingCategories(false);
      }
    }

    loadCategories();
  }, [open]);

  // Sync form state when modal opens or target product changes
  if (open !== prevOpen || product !== prevProduct) {
    setPrevOpen(open);
    setPrevProduct(product);
    if (open) {
      if (product) {
        setName(product.name || "");
        setSlug(product.slug || "");
        setDescription(product.description || "");
        setProductType(product.productType || "PER_AREA");
        setCategoryId(product.categoryId || "");
        setIsActive(product.isActive ?? true);
        setReturnable(product.returnable ?? true);
        setHsnCode(product.hsnCode || "");

        // Convert paise to rupees for form display
        setPriceRupees(product.price != null ? String(product.price / 100) : "");
        setRateRupees(product.rate != null ? String(product.rate / 100) : "");
        setWastagePct(product.wastage != null ? String(product.wastage) : "0");
        setMinAreaSqft(product.minArea != null ? String(product.minArea) : "");
        setRollWidthFt(product.rollWidth != null ? String(product.rollWidth) : "");

        setIsSlugManuallyEdited(true);
      } else {
        setName("");
        setSlug("");
        setDescription("");
        setProductType("PER_AREA");
        setCategoryId("");
        setIsActive(true);
        setReturnable(true);
        setHsnCode("");

        setPriceRupees("");
        setRateRupees("");
        setWastagePct("0");
        setMinAreaSqft("");
        setRollWidthFt("");

        setIsSlugManuallyEdited(false);
      }
      setErrors({});
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (!isSlugManuallyEdited) {
      setSlug(generateSlug(newName));
    }
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: "" }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value);
    setIsSlugManuallyEdited(true);
    if (errors.slug) {
      setErrors((prev) => ({ ...prev, slug: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "Product name is required";
    }
    if (!categoryId.trim()) {
      newErrors.categoryId = "Category selection is required";
    }

    if (productType === "FIXED") {
      if (!priceRupees || isNaN(Number(priceRupees)) || Number(priceRupees) <= 0) {
        newErrors.priceRupees = "Fixed price is required and must be greater than zero";
      }
    } else if (productType === "PER_AREA") {
      if (!rateRupees || isNaN(Number(rateRupees)) || Number(rateRupees) <= 0) {
        newErrors.rateRupees = "Rate per sqft is required and must be greater than zero";
      }
      if (wastagePct !== "" && (isNaN(Number(wastagePct)) || Number(wastagePct) < 0 || Number(wastagePct) > 100)) {
        newErrors.wastagePct = "Wastage must be between 0% and 100%";
      }
      if (minAreaSqft !== "" && (isNaN(Number(minAreaSqft)) || Number(minAreaSqft) < 0)) {
        newErrors.minAreaSqft = "Minimum area cannot be negative";
      }
      if (rollWidthFt !== "" && (isNaN(Number(rollWidthFt)) || Number(rollWidthFt) <= 0)) {
        newErrors.rollWidthFt = "Roll width must be greater than zero";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Build payload converting rupees to minor units (paise) for server consumption
      const payload: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        productType,
        categoryId,
        isActive,
        returnable,
        hsnCode: hsnCode.trim() || undefined,
      };

      if (productType === "FIXED") {
        payload.price = Math.round(Number(priceRupees) * 100);
        payload.rate = null;
        payload.wastage = null;
        payload.minArea = null;
        payload.rollWidth = null;
      } else {
        payload.rate = Math.round(Number(rateRupees) * 100);
        payload.price = null;
        payload.wastage = wastagePct !== "" ? Number(wastagePct) : 0;
        payload.minArea = minAreaSqft !== "" ? Number(minAreaSqft) : null;
        payload.rollWidth = rollWidthFt !== "" ? Number(rollWidthFt) : null;
      }

      const url = isEditing
        ? `/api/admin/products/${product!.id}`
        : "/api/admin/products";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error?.message || "Failed to save product";
        if (errorMsg.toLowerCase().includes("slug")) {
          setErrors({ slug: errorMsg });
        } else if (errorMsg.toLowerCase().includes("category")) {
          setErrors({ categoryId: errorMsg });
        } else if (errorMsg.toLowerCase().includes("name")) {
          setErrors({ name: errorMsg });
        }
        toast.error(isEditing ? "Update Failed" : "Create Failed", errorMsg);
        return;
      }

      toast.success(
        isEditing ? "Product Updated" : "Product Created",
        `Product '${name.trim()}' saved successfully.`
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
      <DialogContent showCloseButton={!isSubmitting} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add New Product"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Section: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-1 text-foreground">Basic Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Product Name" required error={errors.name}>
                <Input
                  id="product-name"
                  placeholder="e.g. Royal Floral Wallpaper"
                  value={name}
                  onChange={handleNameChange}
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField
                label="URL Slug"
                description="Unique URL slug"
                error={errors.slug}
              >
                <Input
                  id="product-slug"
                  placeholder="royal-floral-wallpaper"
                  value={slug}
                  onChange={handleSlugChange}
                  disabled={isSubmitting}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Category" required error={errors.categoryId}>
                <select
                  id="product-category"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: "" }));
                  }}
                  disabled={isSubmitting || isLoadingCategories}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="flex items-center gap-6 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="product-active-switch"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="product-active-switch" className="text-xs font-medium cursor-pointer">
                    {isActive ? "Active (Storefront Visible)" : "Inactive"}
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="product-returnable-switch"
                    checked={returnable}
                    onCheckedChange={setReturnable}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="product-returnable-switch" className="text-xs font-medium cursor-pointer">
                    {returnable ? "Returnable" : "Non-Returnable"}
                  </Label>
                </div>
              </div>
            </div>

            <FormField label="Description" description="Optional plain-text description of the product catalogue item.">
              <Textarea
                id="product-description"
                placeholder="Enter product details..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          {/* Section: Pricing & Product Type */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-1 text-foreground">Pricing Configuration</h3>

            <FormField label="Pricing Model" description="Select how this product's selling price is calculated.">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setProductType("PER_AREA");
                    setErrors({});
                  }}
                  disabled={isSubmitting}
                  className={`p-3 text-left rounded-lg border text-sm font-medium transition-colors ${
                    productType === "PER_AREA"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <div className="font-semibold">PER_AREA</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Priced per sqft (Wallpaper, Blinds)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProductType("FIXED");
                    setErrors({});
                  }}
                  disabled={isSubmitting}
                  className={`p-3 text-left rounded-lg border text-sm font-medium transition-colors ${
                    productType === "FIXED"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <div className="font-semibold">FIXED</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Fixed price per item (Wall Art, Prints)
                  </div>
                </button>
              </div>
            </FormField>

            {productType === "FIXED" ? (
              <div className="p-4 rounded-md border bg-muted/20 space-y-3">
                <FormField label="Fixed Selling Price (₹)" required error={errors.priceRupees}>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-muted-foreground">₹</span>
                    <Input
                      id="product-fixed-price"
                      type="number"
                      step="0.01"
                      placeholder="4999.00"
                      className="pl-7"
                      value={priceRupees}
                      onChange={(e) => {
                        setPriceRupees(e.target.value);
                        if (errors.priceRupees) setErrors((prev) => ({ ...prev, priceRupees: "" }));
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                </FormField>
              </div>
            ) : (
              <div className="p-4 rounded-md border bg-muted/20 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Base Rate per Sqft (₹)" required error={errors.rateRupees}>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm text-muted-foreground">₹</span>
                      <Input
                        id="product-area-rate"
                        type="number"
                        step="0.01"
                        placeholder="150.00"
                        className="pl-7"
                        value={rateRupees}
                        onChange={(e) => {
                          setRateRupees(e.target.value);
                          if (errors.rateRupees) setErrors((prev) => ({ ...prev, rateRupees: "" }));
                        }}
                        disabled={isSubmitting}
                      />
                    </div>
                  </FormField>

                  <FormField
                    label="Wastage (%)"
                    description="Extra percentage buffer (e.g. 10 for 10%)"
                    error={errors.wastagePct}
                  >
                    <Input
                      id="product-wastage"
                      type="number"
                      step="0.1"
                      placeholder="10"
                      value={wastagePct}
                      onChange={(e) => {
                        setWastagePct(e.target.value);
                        if (errors.wastagePct) setErrors((prev) => ({ ...prev, wastagePct: "" }));
                      }}
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Minimum Area (sqft)"
                    description="Minimum billable area floor"
                    error={errors.minAreaSqft}
                  >
                    <Input
                      id="product-min-area"
                      type="number"
                      step="0.1"
                      placeholder="25.0"
                      value={minAreaSqft}
                      onChange={(e) => setMinAreaSqft(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </FormField>

                  <FormField
                    label="Roll Width (ft)"
                    description="Roll/panel coverage width"
                    error={errors.rollWidthFt}
                  >
                    <Input
                      id="product-roll-width"
                      type="number"
                      step="0.01"
                      placeholder="3.0"
                      value={rollWidthFt}
                      onChange={(e) => setRollWidthFt(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
              </div>
            )}
          </div>

          {/* Section: Metadata / Tax */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-1 text-foreground">Catalogue Rules & GST</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="HSN Code"
                description="Tax classification HSN code"
                error={errors.hsnCode}
              >
                <Input
                  id="product-hsn-code"
                  placeholder="e.g. 4814.20"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  disabled={isSubmitting}
                />
              </FormField>
            </div>
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
              {isEditing ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

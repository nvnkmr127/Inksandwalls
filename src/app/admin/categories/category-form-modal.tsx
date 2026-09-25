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
import { generateSlug } from "@/lib/categories/slug";

export interface CategoryData {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  seo?: Record<string, string | null> | null;
}

interface CategoryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryData | null;
  onSuccess: () => void;
}

export function CategoryFormModal({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryFormModalProps) {
  const isEditing = Boolean(category?.id);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [sortOrder, setSortOrder] = React.useState(0);

  // SEO fields
  const [seoData, setSeoData] = React.useState<Record<string, string>>({
    title: "", description: "", canonicalUrl: "", h1: "", introContent: ""
  });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevCategory, setPrevCategory] = React.useState(category);

  if (open !== prevOpen || category !== prevCategory) {
    setPrevOpen(open);
    setPrevCategory(category);
    if (open) {
      if (category) {
        setName(category.name || "");
        setSlug(category.slug || "");
        setDescription(category.description || "");
        setIsActive(category.isActive ?? true);
        setSortOrder(category.sortOrder ?? 0);
        
        const cSeo = category.seo || {};
        setSeoData({
          title: cSeo.title || "", description: cSeo.description || "",
          canonicalUrl: cSeo.canonicalUrl || "", h1: cSeo.h1 || "", introContent: cSeo.introContent || ""
        });
        
        setIsSlugManuallyEdited(true);
      } else {
        setName("");
        setSlug("");
        setDescription("");
        setIsActive(true);
        setSortOrder(0);

        setSeoData({
          title: "", description: "", canonicalUrl: "", h1: "", introContent: ""
        });

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
      newErrors.name = "Category name is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        isActive,
        sortOrder: Number(sortOrder) || 0,
        seo: Object.fromEntries(Object.entries(seoData).map(([k, v]) => [k, v.trim() || null])),
      };

      const url = isEditing
        ? `/api/admin/categories/${category!.id}`
        : "/api/admin/categories";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error?.message || "Failed to save category";
        if (errorMsg.toLowerCase().includes("slug")) {
          setErrors({ slug: errorMsg });
        } else if (errorMsg.toLowerCase().includes("name")) {
          setErrors({ name: errorMsg });
        }
        toast.error(isEditing ? "Update Failed" : "Create Failed", errorMsg);
        return;
      }

      toast.success(
        isEditing ? "Category Updated" : "Category Created",
        `Category '${payload.name}' saved successfully.`
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
      <DialogContent showCloseButton={!isSubmitting} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Category" : "Add New Category"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <FormField label="Category Name" required error={errors.name}>
            <Input
              id="category-name"
              placeholder="e.g. Wallpapers"
              value={name}
              onChange={handleNameChange}
              disabled={isSubmitting}
            />
          </FormField>

          <FormField
            label="URL Slug"
            description="Auto-generated URL identifier. Must be unique."
            error={errors.slug}
          >
            <Input
              id="category-slug"
              placeholder="wallpapers"
              value={slug}
              onChange={handleSlugChange}
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="Description" description="Optional text description of this category.">
            <Textarea
              id="category-description"
              placeholder="Describe products in this category..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <FormField label="Sort Order" description="Display ordering number (default 0)">
              <Input
                id="category-sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                disabled={isSubmitting}
              />
            </FormField>

            <div className="flex flex-col gap-2 justify-center">
              <Label htmlFor="category-active-switch" className="text-xs font-semibold">
                Status
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="category-active-switch"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={isSubmitting}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {isActive ? "Active (Visible)" : "Inactive (Hidden)"}
                </span>
              </div>
            </div>
          </div>

          {/* Section: SEO Metadata */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold pb-1 text-foreground">SEO Metadata</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Meta Title" description="Overrides default title tag">
                <Input
                  placeholder="Custom SEO Title"
                  value={seoData.title}
                  onChange={(e) => setSeoData(s => ({ ...s, title: e.target.value }))}
                  disabled={isSubmitting}
                />
              </FormField>
              <FormField label="Meta Description" description="Max 160 characters recommended">
                <Input
                  placeholder="Custom Meta Description"
                  value={seoData.description}
                  onChange={(e) => setSeoData(s => ({ ...s, description: e.target.value }))}
                  disabled={isSubmitting}
                />
              </FormField>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Canonical URL" description="Leave empty to use default category URL">
                <Input
                  placeholder="https://example.com/category/abc"
                  value={seoData.canonicalUrl}
                  onChange={(e) => setSeoData(s => ({ ...s, canonicalUrl: e.target.value }))}
                  disabled={isSubmitting}
                />
              </FormField>
              <FormField label="H1 Tag Override" description="Overrides the default H1 heading">
                <Input
                  placeholder="Custom H1 text"
                  value={seoData.h1}
                  onChange={(e) => setSeoData(s => ({ ...s, h1: e.target.value }))}
                  disabled={isSubmitting}
                />
              </FormField>
            </div>

            <FormField label="Intro Content" description="Rich text or long description for the top of the category page">
              <Textarea
                placeholder="Detailed SEO description..."
                rows={3}
                value={seoData.introContent}
                onChange={(e) => setSeoData(s => ({ ...s, introContent: e.target.value }))}
                disabled={isSubmitting}
              />
            </FormField>
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
              {isEditing ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

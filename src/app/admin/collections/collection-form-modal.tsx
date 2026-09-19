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
import { generateSlug } from "@/lib/collections/slug";

export interface CollectionData {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface CollectionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: CollectionData | null;
  onSuccess: () => void;
}

export function CollectionFormModal({
  open,
  onOpenChange,
  collection,
  onSuccess,
}: CollectionFormModalProps) {
  const isEditing = Boolean(collection?.id);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [sortOrder, setSortOrder] = React.useState(0);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevCollection, setPrevCollection] = React.useState(collection);

  if (open !== prevOpen || collection !== prevCollection) {
    setPrevOpen(open);
    setPrevCollection(collection);
    if (open) {
      if (collection) {
        setName(collection.name || "");
        setSlug(collection.slug || "");
        setDescription(collection.description || "");
        setIsActive(collection.isActive ?? true);
        setSortOrder(collection.sortOrder ?? 0);
        setIsSlugManuallyEdited(true);
      } else {
        setName("");
        setSlug("");
        setDescription("");
        setIsActive(true);
        setSortOrder(0);
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
      newErrors.name = "Collection name is required";
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
      };

      const url = isEditing
        ? `/api/admin/collections/${collection!.id}`
        : "/api/admin/collections";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error?.message || "Failed to save collection";
        if (errorMsg.toLowerCase().includes("slug")) {
          setErrors({ slug: errorMsg });
        } else if (errorMsg.toLowerCase().includes("name")) {
          setErrors({ name: errorMsg });
        }
        toast.error(isEditing ? "Update Failed" : "Create Failed", errorMsg);
        return;
      }

      toast.success(
        isEditing ? "Collection Updated" : "Collection Created",
        `Collection '${payload.name}' saved successfully.`
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
          <DialogTitle>{isEditing ? "Edit Collection" : "Add New Collection"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <FormField label="Collection Name" required error={errors.name}>
            <Input
              id="collection-name"
              placeholder="e.g. New Arrivals"
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
              id="collection-slug"
              placeholder="new-arrivals"
              value={slug}
              onChange={handleSlugChange}
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="Description" description="Optional text description of this collection.">
            <Textarea
              id="collection-description"
              placeholder="Describe products in this collection..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <FormField label="Sort Order" description="Display ordering number (default 0)">
              <Input
                id="collection-sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                disabled={isSubmitting}
              />
            </FormField>

            <div className="flex flex-col gap-2 justify-center">
              <Label htmlFor="collection-active-switch" className="text-xs font-semibold">
                Status
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="collection-active-switch"
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
              {isEditing ? "Save Changes" : "Create Collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

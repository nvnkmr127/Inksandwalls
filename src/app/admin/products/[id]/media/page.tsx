"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  UploadCloud,
  Star,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImageIcon,
  Layers,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { toast } from "@/components/feedback/toast";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  productType: "PER_AREA" | "FIXED";
}

export interface MediaItem {
  id: string;
  productId: string;
  objectKey: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  mimeType: string | null;
  size: number | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProductMediaPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = React.useState<ProductSummary | null>(null);
  const [mediaList, setMediaList] = React.useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();

  // Upload state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadAltText, setUploadAltText] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Edit Alt Text modal
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editingMedia, setEditingMedia] = React.useState<MediaItem | null>(null);
  const [editAltText, setEditAltText] = React.useState("");
  const [isSavingAltText, setIsSavingAltText] = React.useState(false);

  // Delete modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [mediaToDelete, setMediaToDelete] = React.useState<MediaItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Primary action state
  const [settingPrimaryId, setSettingPrimaryId] = React.useState<string | null>(null);

  // Drag & drop reorder state
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [isReordering, setIsReordering] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshList = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadMedia() {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const res = await fetch(`/api/admin/products/${productId}/media`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setIsError(true);
          setErrorMessage(data.error?.message || "Failed to load product media.");
          return;
        }

        if (data.product) {
          setProduct(data.product);
        }
        setMediaList(data.items || []);
      } catch {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage("Network error occurred while fetching product media.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMedia();

    return () => {
      cancelled = true;
    };
  }, [productId, refreshTrigger]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle Drag & Drop in upload zone
  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleZoneDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Perform upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select an image file to upload.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (uploadAltText.trim()) {
        formData.append("altText", uploadAltText.trim());
      }

      const res = await fetch(`/api/admin/products/${productId}/media`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message || "Image upload failed.");
        return;
      }

      toast.success("Image uploaded successfully.");
      setSelectedFile(null);
      setUploadAltText("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await refreshList();
    } catch {
      toast.error("An unexpected error occurred during image upload.");
    } finally {
      setIsUploading(false);
    }
  };

  // Set primary image
  const handleSetPrimary = async (item: MediaItem) => {
    if (item.isPrimary) return;

    setSettingPrimaryId(item.id);

    try {
      const res = await fetch(`/api/admin/products/${productId}/media/${item.id}/primary`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message || "Failed to set primary image.");
        return;
      }

      toast.success("Primary image updated.");
      setMediaList((prev) =>
        prev.map((m) => ({
          ...m,
          isPrimary: m.id === item.id,
        }))
      );
    } catch {
      toast.error("Network error while setting primary image.");
    } finally {
      setSettingPrimaryId(null);
    }
  };

  // Open Edit Alt Text dialog
  const handleOpenEditAlt = (item: MediaItem) => {
    setEditingMedia(item);
    setEditAltText(item.altText || "");
    setEditModalOpen(true);
  };

  // Save Alt Text
  const handleSaveAltText = async () => {
    if (!editingMedia) return;

    setIsSavingAltText(true);

    try {
      const res = await fetch(`/api/admin/products/${productId}/media/${editingMedia.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: editAltText }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message || "Failed to update alt text.");
        return;
      }

      toast.success("Alt text updated successfully.");
      setMediaList((prev) =>
        prev.map((m) => (m.id === editingMedia.id ? { ...m, altText: data.altText } : m))
      );
      setEditModalOpen(false);
      setEditingMedia(null);
    } catch {
      toast.error("Network error while updating alt text.");
    } finally {
      setIsSavingAltText(false);
    }
  };

  // Open Delete modal
  const handleOpenDelete = (item: MediaItem) => {
    setMediaToDelete(item);
    setDeleteConfirmOpen(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!mediaToDelete) return;

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/products/${productId}/media/${mediaToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message || "Failed to delete media.");
        return;
      }

      toast.success("Media deleted successfully.");
      setDeleteConfirmOpen(false);
      setMediaToDelete(null);
      await refreshList();
    } catch {
      toast.error("Network error while deleting media.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit reordered list to server
  const persistReorder = async (newList: MediaItem[]) => {
    setIsReordering(true);
    try {
      const mediaIds = newList.map((m) => m.id);
      const res = await fetch(`/api/admin/products/${productId}/media/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message || "Failed to persist media ordering.");
        await refreshList(); // Revert on failure
        return;
      }

      toast.success("Media order saved.");
    } catch {
      toast.error("Network error while updating media order.");
      await refreshList();
    } finally {
      setIsReordering(false);
    }
  };

  // Reorder buttons (Move Left / Right)
  const handleMoveOrder = async (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mediaList.length) return;

    const updated = [...mediaList];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);

    setMediaList(updated);
    await persistReorder(updated);
  };

  // HTML5 Drag & Drop reorder handlers
  const handleCardDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleCardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...mediaList];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setMediaList(updated);
  };

  const handleCardDragEnd = async () => {
    if (draggedIndex !== null) {
      setDraggedIndex(null);
      await persistReorder(mediaList);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/products"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Products
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-emerald-600" />
            Product Media
          </h1>
          {product && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{product.name}</span>
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{product.slug}</span>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 bg-indigo-500/10">
                {product.productType}
              </Badge>
            </div>
          )}
        </div>

        {product && product.productType === "FIXED" && (
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/products/${productId}/variants`}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Layers className="h-4 w-4 mr-1.5 text-indigo-600" />
              Manage Variants
            </Link>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border rounded-xl bg-card/40 p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mb-3" />
          <p className="text-sm text-muted-foreground">Loading product media assets...</p>
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load media"
          description={errorMessage}
          onRetry={refreshList}
        />
      ) : (
        <div className="space-y-8">
          {/* Upload Section */}
          <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Upload Media</h2>
                <p className="text-xs text-muted-foreground">
                  Processed with Sharp into WebP variants and stored securely in Cloudflare R2.
                </p>
              </div>
              <Badge variant="neutral" className="text-xs">
                Max 10MB
              </Badge>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div
                onDragOver={handleZoneDragOver}
                onDragLeave={handleZoneDragLeave}
                onDrop={handleZoneDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                  isDraggingOver
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "border-border hover:border-emerald-500/50 hover:bg-muted/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
                <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                {selectedFile ? (
                  <div className="text-center space-y-1">
                    <p className="font-medium text-sm text-foreground">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(0)} KB • Click to choose another
                    </p>
                  </div>
                ) : (
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Drag & drop an image here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPEG, PNG, WebP, AVIF, or GIF up to 10MB
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                <div className="sm:col-span-3">
                  <Input
                    placeholder="Alt text (e.g. Living room wall art with black frame)"
                    value={uploadAltText}
                    onChange={(e) => setUploadAltText(e.target.value)}
                    disabled={isUploading}
                    maxLength={500}
                    className="text-sm"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button
                    type="submit"
                    disabled={!selectedFile || isUploading}
                    isLoading={isUploading}
                    className="w-full"
                  >
                    Upload Image
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Media Grid Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Product Gallery</h2>
                <p className="text-xs text-muted-foreground">
                  Drag items or use the arrow controls to change order. The first image or primary image is shown on catalogue cards.
                </p>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {mediaList.length} {mediaList.length === 1 ? "image" : "images"}
              </div>
            </div>

            {mediaList.length === 0 ? (
              <EmptyState
                icon={<ImageIcon className="h-6 w-6" />}
                title="No media uploaded yet"
                description="Upload the first image for this product using the upload form above. It will automatically become the primary image."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mediaList.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleCardDragStart(index)}
                    onDragOver={(e) => handleCardDragOver(e, index)}
                    onDragEnd={handleCardDragEnd}
                    className={`group relative rounded-xl border bg-card overflow-hidden shadow-xs transition-all ${
                      draggedIndex === index ? "opacity-40 scale-95 border-emerald-500" : ""
                    } ${
                      item.isPrimary
                        ? "ring-2 ring-emerald-500/50 border-emerald-500"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    {/* Header Bar: Drag handle & order controls */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b text-xs">
                      <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing text-muted-foreground">
                        <GripVertical className="h-3.5 w-3.5" />
                        <span className="font-mono text-[11px]">#{index + 1}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={index === 0 || isReordering}
                          onClick={() => handleMoveOrder(index, "left")}
                          title="Move earlier"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={index === mediaList.length - 1 || isReordering}
                          onClick={() => handleMoveOrder(index, "right")}
                          title="Move later"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Image Preview Container */}
                    <div className="relative aspect-4/3 w-full bg-muted/20 overflow-hidden flex items-center justify-center">
                      <OptimizedImage
                        src={item.objectKey}
                        alt={item.altText || "Product media image"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />

                      {/* Primary badge overlay */}
                      {item.isPrimary ? (
                        <div className="absolute top-2 left-2 z-10">
                          <Badge
                            variant="success"
                            className="shadow-xs text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
                            Primary
                          </Badge>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(item)}
                          disabled={settingPrimaryId === item.id}
                          className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white text-[11px] font-medium px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-xs"
                        >
                          <Star className="h-3 w-3 text-amber-400" />
                          Set Primary
                        </button>
                      )}
                    </div>

                    {/* Image Metadata & Alt Text */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                        <span>
                          {item.width && item.height ? `${item.width}×${item.height}` : "WebP"}
                        </span>
                        <span>{item.size ? `${(item.size / 1024).toFixed(0)} KB` : ""}</span>
                      </div>

                      <div className="min-h-[28px] text-xs">
                        {item.altText ? (
                          <p className="line-clamp-2 text-foreground/90 text-xs" title={item.altText}>
                            <span className="font-semibold text-muted-foreground mr-1">Alt:</span>
                            {item.altText}
                          </p>
                        ) : (
                          <p className="text-amber-600/80 italic text-[11px] flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Missing alt text (SEO)
                          </p>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between border-t pt-2 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditAlt(item)}
                          className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Edit Alt
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDelete(item)}
                          className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Alt Text Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Image Alt Text</DialogTitle>
            <DialogDescription>
              Alt text improves accessibility for screen readers and satisfies search engine product indexing rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Descriptive alt text for this product image..."
              value={editAltText}
              onChange={(e) => setEditAltText(e.target.value)}
              maxLength={500}
              rows={3}
              className="text-sm resize-none"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Plain text description without quotes or control characters.</span>
              <span>{editAltText.length}/500</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={isSavingAltText}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAltText}
              isLoading={isSavingAltText}
            >
              Save Alt Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Product Image"
        description="Are you sure you want to delete this product image? The image and all responsive WebP variants will be permanently deleted from Cloudflare R2 storage. If this is the primary image, another image will automatically become primary."
        confirmText="Delete Image"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

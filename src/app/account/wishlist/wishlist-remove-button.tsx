"use client";

import { useState } from "react";
import { removeWishlistAction } from "@/app/actions/wishlist";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function WishlistRemoveButton({ productId }: { productId: string }) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const result = await removeWishlistAction(productId);
      if (result.success) {
        toast.success("Removed from wishlist");
      } else {
        toast.error(result.error || "Failed to remove");
      }
    } catch (e) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={isRemoving}
      aria-label="Remove from wishlist"
      className="inline-flex items-center justify-center rounded-md border border-input bg-background w-9 h-9 text-sm font-medium shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

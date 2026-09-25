"use client";

import { useState, useTransition } from "react";
import { toggleWishlistAction } from "@/app/actions/wishlist";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface WishlistToggleButtonProps {
  productId: string;
  initialIsWishlisted?: boolean;
  className?: string;
}

export function WishlistToggleButton({ productId, initialIsWishlisted = false, className }: WishlistToggleButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsWishlisted);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      // Optimistic update
      const previousState = isWishlisted;
      setIsWishlisted(!isWishlisted);
      
      try {
        const result = await toggleWishlistAction(productId);
        if (!result.success) {
          // Revert on failure
          setIsWishlisted(previousState);
          toast.error(result.error || "Failed to update wishlist");
        }
      } catch (error) {
        setIsWishlisted(previousState);
        toast.error("An unexpected error occurred");
      }
    });
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleToggle();
      }}
      disabled={isPending}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "inline-flex items-center justify-center rounded-full w-9 h-9 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isWishlisted 
          ? "bg-primary/10 text-primary hover:bg-primary/20" 
          : "bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground backdrop-blur-sm shadow-sm",
        className
      )}
    >
      <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} />
    </button>
  );
}

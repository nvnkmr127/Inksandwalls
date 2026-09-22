"use client";

import React, { useState } from "react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

export interface GalleryMediaItem {
  id: string;
  objectKey: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductGalleryProps {
  media: GalleryMediaItem[];
  productName: string;
  isPerArea?: boolean;
  isReturnable?: boolean;
}

export function ProductGallery({
  media,
  productName,
  isPerArea = false,
  isReturnable = true,
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // If no media items exist, render accessible fallback
  if (!media || media.length === 0) {
    return (
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-border bg-muted/40 flex flex-col items-center justify-center p-8 text-muted-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/80">
          <ImageIcon className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-3 text-sm font-medium">No images available for this product</p>
      </div>
    );
  }

  const activeIndex = Math.min(selectedIndex, media.length - 1);
  const activeMedia = media[activeIndex];
  const altText = activeMedia.altText || productName;

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Primary Image Stage */}
      <div
        className="group relative aspect-4/3 sm:aspect-1/1 w-full overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-xs"
        role="region"
        aria-label="Product Media Gallery"
      >
        <OptimizedImage
          src={activeMedia.objectKey}
          alt={altText}
          priority
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 55vw, 600px"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-102"
        />

        {/* Product Badges */}
        <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-2 pointer-events-none">
          {isPerArea ? (
            <Badge variant="secondary" className="bg-background/90 text-foreground backdrop-blur-xs font-semibold px-2.5 py-1 shadow-xs">
              Custom Size
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-background/90 backdrop-blur-xs font-semibold px-2.5 py-1 shadow-xs">
              Wall Art
            </Badge>
          )}

          {!isReturnable && (
            <Badge variant="outline" className="bg-background/90 text-muted-foreground text-xs px-2 py-0.5 backdrop-blur-xs shadow-xs">
              Custom-Cut (Non-Returnable)
            </Badge>
          )}
        </div>

        {/* Previous / Next Arrow Controls (visible when multiple images exist) */}
        {media.length > 1 && (
          <div className="absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none">
            <button
              type="button"
              onClick={handlePrevious}
              aria-label="Previous image"
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-xs shadow-sm hover:bg-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring transition-opacity"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next image"
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-xs shadow-sm hover:bg-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring transition-opacity"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Thumbnails Navigation Strip */}
      {media.length > 1 && (
        <div
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin focus-visible:outline-hidden"
          role="tablist"
          aria-label="Product image thumbnails"
        >
          {media.map((item, index) => {
            const isSelected = index === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`View image ${index + 1} of ${media.length}`}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "relative h-18 w-18 shrink-0 overflow-hidden rounded-lg border-2 bg-muted/40 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 scale-105 shadow-xs"
                    : "border-border hover:border-muted-foreground/50 opacity-70 hover:opacity-100"
                )}
              >
                <OptimizedImage
                  src={item.objectKey}
                  alt={item.altText || `${productName} thumbnail ${index + 1}`}
                  fill
                  sizes="72px"
                  className="object-cover object-center"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

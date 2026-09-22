import React from "react";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Badge } from "@/components/ui/badge";
import { formatProductPriceDisplay } from "@/lib/money";
import type { StorefrontProductListingItem } from "@/lib/storefront/catalog-service";
import { ImageIcon } from "lucide-react";

export interface ProductCardProps {
  product: StorefrontProductListingItem;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const primaryMedia = product.media?.[0];
  const pricing = formatProductPriceDisplay(product);
  const isPerArea = product.productType === "PER_AREA";

  return (
    <article className="group relative flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/30 overflow-hidden">
      {/* Product Image Container */}
      <div className="relative aspect-4/5 w-full overflow-hidden bg-muted/40">
        {primaryMedia ? (
          <OptimizedImage
            src={primaryMedia.objectKey}
            alt={primaryMedia.altText || product.name}
            priority={priority}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground/60">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/80">
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="text-xs font-medium tracking-wide uppercase">No image available</span>
          </div>
        )}

        {/* Type & Returnable Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 pointer-events-none">
          {isPerArea ? (
            <Badge variant="secondary" className="bg-background/90 text-foreground backdrop-blur-xs font-medium text-[11px] px-2 py-0.5 shadow-2xs">
              Custom Size
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-background/90 backdrop-blur-xs font-medium text-[11px] px-2 py-0.5 shadow-2xs">
              Wall Art
            </Badge>
          )}

          {!product.returnable && (
            <Badge variant="outline" className="bg-background/90 text-muted-foreground text-[10px] px-1.5 py-0.5 backdrop-blur-xs shadow-2xs">
              Custom-Cut
            </Badge>
          )}
        </div>
      </div>

      {/* Product Details */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category Context */}
        {product.category?.name && (
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            {product.category.name}
          </span>
        )}

        {/* Product Title */}
        <h3 className="font-semibold text-base text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
          <Link
            href={`/products/${product.slug}`}
            className="focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
          >
            <span className="absolute inset-0" aria-hidden="true" />
            {product.name}
          </Link>
        </h3>

        {/* Pricing Representation */}
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-base font-bold text-foreground">
            {pricing.formattedPrice}
          </span>
          {pricing.unitLabel && (
            <span className="text-xs text-muted-foreground font-medium">
              {pricing.unitLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

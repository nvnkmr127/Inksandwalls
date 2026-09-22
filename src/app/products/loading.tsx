import React from "react";

export default function ProductsLoading() {
  return (
    <div
      className="container max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-pulse"
      aria-busy="true"
      aria-label="Loading catalogue products"
    >
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded-md bg-muted" />
          <div className="h-5 w-20 rounded-md bg-muted" />
        </div>
        <div className="h-4 w-72 rounded-md bg-muted/60" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-full sm:w-80 rounded-lg bg-muted" />
        <div className="h-10 w-40 rounded-lg bg-muted" />
      </div>

      {/* Product Cards Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border border-border bg-card overflow-hidden"
          >
            {/* Image Skeleton */}
            <div className="aspect-4/5 w-full bg-muted/70" />
            {/* Details Skeleton */}
            <div className="p-4 space-y-3">
              <div className="h-3 w-20 rounded-sm bg-muted/50" />
              <div className="h-4 w-3/4 rounded-sm bg-muted" />
              <div className="h-5 w-24 rounded-sm bg-muted/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

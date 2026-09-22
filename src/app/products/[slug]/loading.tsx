import React from "react";

export default function ProductDetailLoading() {
  return (
    <div className="container max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12 animate-pulse">
      {/* Breadcrumb Skeleton */}
      <div className="h-4 w-48 rounded-md bg-muted" />

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Gallery Skeleton */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-4/3 sm:aspect-1/1 w-full rounded-2xl bg-muted" />
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-18 w-18 rounded-lg bg-muted" />
            ))}
          </div>
        </div>

        {/* Right Info & Config Skeleton */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3 border-b border-border pb-6">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-8 w-3/4 rounded bg-muted" />
            <div className="h-6 w-32 rounded bg-muted" />
            <div className="h-16 w-full rounded bg-muted" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-muted" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 rounded-lg bg-muted" />
              <div className="h-10 rounded-lg bg-muted" />
            </div>
            <div className="h-24 rounded-xl bg-muted" />
            <div className="h-12 rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

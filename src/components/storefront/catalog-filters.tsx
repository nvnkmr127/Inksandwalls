"use client";

import React, { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface CatalogFiltersProps {
  categories: Array<{ id: string; name: string; slug: string }>;
  collections: Array<{ id: string; name: string; slug: string }>;
  activeCategory?: string;
  activeCollection?: string;
  activeType?: string;
  activeSort?: string;
  activeSearch?: string;
}

export function CatalogFilters({
  categories,
  collections,
  activeCategory,
  activeCollection,
  activeType = "all",
  activeSort = "newest",
  activeSearch = "",
}: CatalogFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [prevActiveSearch, setPrevActiveSearch] = React.useState(activeSearch);
  const [searchInput, setSearchInput] = React.useState(activeSearch);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = React.useState(false);

  // Sync internal search input if URL changes externally (React recommended render pattern)
  if (prevActiveSearch !== activeSearch) {
    setPrevActiveSearch(activeSearch);
    setSearchInput(activeSearch);
  }

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value && value !== "all" && value.trim() !== "") {
      params.set(key, value.trim());
    } else {
      params.delete(key);
    }
    // Reset page to 1 whenever filtering changes
    params.delete("page");

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `/products?${query}` : "/products");
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("search", searchInput);
  };

  const clearAllFilters = () => {
    setSearchInput("");
    startTransition(() => {
      router.push("/products");
    });
    setIsMobileFilterOpen(false);
  };

  const hasActiveFilters = Boolean(
    activeCategory ||
    activeCollection ||
    (activeType && activeType !== "all") ||
    activeSearch
  );

  return (
    <div className="w-full space-y-4">
      {/* Top Filter Bar: Search, Sort & Mobile Trigger */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Input
            type="search"
            placeholder="Search wallpapers, murals, prints..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-10 h-10 rounded-lg text-sm bg-background"
            aria-label="Search products"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                updateParam("search", null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search input"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2">
          {/* Mobile Filter Drawer Trigger */}
          <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:hidden h-10 gap-2 font-medium"
                  aria-label="Open filter options"
                />
              }
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-6">
              <SheetHeader>
                <SheetTitle className="text-left font-bold text-lg">Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Product Type Filter */}
                <div>
                  <h4 className="text-sm font-semibold mb-2.5">Product Type</h4>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { label: "All Products", value: "all" },
                      { label: "Wallpapers / Murals (Made to Order)", value: "PER_AREA" },
                      { label: "Wall Art Prints (Fixed)", value: "FIXED" },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          updateParam("type", type.value);
                          setIsMobileFilterOpen(false);
                        }}
                        className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          activeType === type.value
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2.5">Category</h4>
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          updateParam("category", null);
                          setIsMobileFilterOpen(false);
                        }}
                        className={`text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                          !activeCategory
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All Categories
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            updateParam("category", cat.slug);
                            setIsMobileFilterOpen(false);
                          }}
                          className={`text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                            activeCategory === cat.slug
                              ? "bg-primary text-primary-foreground font-medium"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collections */}
                {collections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2.5">Collection</h4>
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          updateParam("collection", null);
                          setIsMobileFilterOpen(false);
                        }}
                        className={`text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                          !activeCollection
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All Collections
                      </button>
                      {collections.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => {
                            updateParam("collection", col.slug);
                            setIsMobileFilterOpen(false);
                          }}
                          className={`text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                            activeCollection === col.slug
                              ? "bg-primary text-primary-foreground font-medium"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={clearAllFilters}
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex text-xs font-medium text-muted-foreground items-center gap-1">
              <ArrowUpDown className="h-3 w-3" /> Sort:
            </span>
            <div className="w-[170px]">
              <Select
                value={activeSort}
                onChange={(e) => updateParam("sort", e.target.value)}
                options={[
                  { label: "Newest Arrivals", value: "newest" },
                  { label: "Price: Low to High", value: "price_asc" },
                  { label: "Price: High to Low", value: "price_desc" },
                  { label: "Name: A to Z", value: "name_asc" },
                  { label: "Name: Z to A", value: "name_desc" },
                ]}
                className="h-10 text-xs sm:text-sm bg-background font-medium"
                aria-label="Sort products by"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Filter Pills */}
      <div className="hidden sm:flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
        {/* Type pills */}
        <div className="inline-flex rounded-lg bg-muted/60 p-1 text-xs font-medium">
          {[
            { label: "All", value: "all" },
            { label: "Made to Order", value: "PER_AREA" },
            { label: "Wall Art", value: "FIXED" },
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateParam("type", type.value)}
              className={`px-3 py-1 rounded-md transition-all ${
                activeType === type.value
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Category Pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l border-border/50">
            <button
              type="button"
              onClick={() => updateParam("category", null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                !activeCategory
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateParam("category", cat.slug)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat.slug
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-7 text-xs text-muted-foreground hover:text-foreground ml-auto gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
}

export function CatalogPagination({ currentPage, totalPages }: CatalogPaginationProps) {
  const searchParams = useSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (pageNumber > 1) {
      params.set("page", String(pageNumber));
    } else {
      params.delete("page");
    }
    const query = params.toString();
    return query ? `/products?${query}` : "/products";
  };

  // Build visible page number array
  const pages: number[] = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className="flex items-center justify-center gap-1.5 py-8"
    >
      {/* Previous Button */}
      {currentPage > 1 ? (
        <Link href={createPageUrl(currentPage - 1)} passHref>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 opacity-40 cursor-not-allowed"
          disabled
          aria-label="Previous page (disabled)"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Page Numbers */}
      {startPage > 1 && (
        <>
          <Link href={createPageUrl(1)} passHref>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 text-xs"
              aria-label="Go to page 1"
            >
              1
            </Button>
          </Link>
          {startPage > 2 && (
            <span className="px-1 text-muted-foreground text-sm" aria-hidden="true">
              …
            </span>
          )}
        </>
      )}

      {pages.map((p) => {
        const isCurrent = p === currentPage;
        return (
          <Link key={p} href={createPageUrl(p)} passHref>
            <Button
              variant={isCurrent ? "default" : "outline"}
              size="sm"
              className="h-9 w-9 text-xs font-medium"
              aria-label={`Page ${p}`}
              aria-current={isCurrent ? "page" : undefined}
            >
              {p}
            </Button>
          </Link>
        );
      })}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="px-1 text-muted-foreground text-sm" aria-hidden="true">
              …
            </span>
          )}
          <Link href={createPageUrl(totalPages)} passHref>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 text-xs"
              aria-label={`Go to page ${totalPages}`}
            >
              {totalPages}
            </Button>
          </Link>
        </>
      )}

      {/* Next Button */}
      {currentPage < totalPages ? (
        <Link href={createPageUrl(currentPage + 1)} passHref>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 opacity-40 cursor-not-allowed"
          disabled
          aria-label="Next page (disabled)"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </nav>
  );
}

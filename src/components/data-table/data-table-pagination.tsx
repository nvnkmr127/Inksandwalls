"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

export interface DataTablePaginationProps {
  pageIndex: number
  pageSize: number
  pageCount: number
  totalCount?: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export function DataTablePagination({
  pageIndex,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: DataTablePaginationProps) {
  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex < pageCount - 1

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-3 border-t border-border">
      <div className="text-xs text-muted-foreground">
        {totalCount !== undefined ? (
          <>
            Showing <span className="font-medium text-foreground">{pageIndex * pageSize + 1}</span> to{" "}
            <span className="font-medium text-foreground">
              {Math.min((pageIndex + 1) * pageSize, totalCount)}
            </span>{" "}
            of <span className="font-medium text-foreground">{totalCount}</span> entries
          </>
        ) : (
          <>
            Page <span className="font-medium text-foreground">{pageIndex + 1}</span> of{" "}
            <span className="font-medium text-foreground">{Math.max(1, pageCount)}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</span>
            <Select
              className="h-8 w-16 text-xs"
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(0)}
            disabled={!canPreviousPage}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={!canPreviousPage}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <span className="px-2 text-xs font-medium text-foreground">
            {pageIndex + 1} / {Math.max(1, pageCount)}
          </span>

          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canNextPage}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(pageCount - 1)}
            disabled={!canNextPage}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { DataTableToolbar, FilterOption } from "./data-table-toolbar"
import { DataTablePagination } from "./data-table-pagination"
import { LoadingState } from "@/components/feedback/loading-state"
import { EmptyState } from "@/components/feedback/empty-state"
import { ErrorState } from "@/components/feedback/error-state"
import { cn } from "cn"

export type SortDirection = "asc" | "desc" | null

export interface ColumnDef<T> {
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  getRowId?: (row: T) => string
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterOption[]
  onFilterChange?: (filterId: string, value: string) => void
  onResetFilters?: () => void
  sortField?: string | null
  sortDirection?: SortDirection
  onSortChange?: (field: string) => void
  pageIndex?: number
  pageSize?: number
  totalCount?: number
  onPageChange?: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  filters = [],
  onFilterChange,
  onResetFilters,
  sortField,
  sortDirection,
  onSortChange,
  pageIndex = 0,
  pageSize = 10,
  totalCount,
  onPageChange,
  onPageSizeChange,
  emptyTitle = "No records found",
  emptyDescription = "There are no records to display at this time.",
  emptyAction,
  className,
}: DataTableProps<T>) {
  const hasActiveFilters = filters.some((f) => !!f.value) || !!searchValue
  const pageCount = totalCount !== undefined ? Math.ceil(totalCount / pageSize) : 1

  return (
    <div className={cn("w-full space-y-3", className)}>
      {(onSearchChange || filters.length > 0) && (
        <DataTableToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          onFilterChange={onFilterChange}
          onResetFilters={onResetFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn("px-4 py-3 select-none", col.className)}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.id)}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                    >
                      {col.header}
                      {sortField === col.id ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <LoadingState title="Loading table data..." />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <ErrorState
                    title="Failed to load table records"
                    description={errorMessage}
                    onRetry={onRetry}
                  />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <EmptyState
                    title={hasActiveFilters ? "No matching records found" : emptyTitle}
                    description={
                      hasActiveFilters
                        ? "Try adjusting your search criteria or clearing filters."
                        : emptyDescription
                    }
                    action={
                      hasActiveFilters && onResetFilters ? (
                        <button
                          type="button"
                          onClick={onResetFilters}
                          className="text-xs text-primary font-medium underline"
                        >
                          Clear all filters
                        </button>
                      ) : (
                        emptyAction
                      )
                    }
                  />
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const key = getRowId ? getRowId(row) : `row_${idx}`
                return (
                  <tr key={key} className="hover:bg-muted/30 transition-colors">
                    {columns.map((col) => (
                      <td key={col.id} className={cn("px-4 py-3 align-middle", col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && !isError && data.length > 0 && onPageChange && (
        <DataTablePagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={pageCount}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}

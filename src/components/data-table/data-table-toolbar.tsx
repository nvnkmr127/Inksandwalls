"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectOption } from "@/components/ui/select"

export interface FilterOption {
  id: string
  label: string
  options: SelectOption[]
  value?: string
}

export interface DataTableToolbarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterOption[]
  onFilterChange?: (filterId: string, value: string) => void
  onResetFilters?: () => void
  hasActiveFilters?: boolean
}

export function DataTableToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search records...",
  filters = [],
  onFilterChange,
  onResetFilters,
  hasActiveFilters = false,
}: DataTableToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4">
      <div className="flex flex-1 items-center gap-2 flex-wrap">
        {onSearchChange && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-8 text-xs"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {filters.map((filter) => (
          <div key={filter.id} className="w-full sm:w-40">
            <Select
              className="text-xs h-8"
              value={filter.value || ""}
              onChange={(e) => onFilterChange?.(filter.id, e.target.value)}
            >
              <option value="">All {filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        ))}

        {(hasActiveFilters || searchValue) && onResetFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-8 px-2 text-xs"
          >
            Clear All
            <X className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

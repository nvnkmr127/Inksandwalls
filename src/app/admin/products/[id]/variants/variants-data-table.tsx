"use client";

import * as React from "react";
import { DataTable, ColumnDef, SortDirection } from "@/components/data-table/data-table";
import { FilterOption } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Power } from "lucide-react";

export interface VariantItem {
  id: string;
  productId: string;
  name: string;
  sku?: string | null;
  price: number; // in minor units (paise)
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface VariantsDataTableProps {
  data: VariantItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortField: string;
  sortDirection: SortDirection;
  onSortChange: (field: string) => void;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEdit: (variant: VariantItem) => void;
  onToggleStatus: (variant: VariantItem) => void;
  onDelete: (variant: VariantItem) => void;
  onAddVariantClick: () => void;
}

export function VariantsDataTable({
  data,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  pageIndex,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onToggleStatus,
  onDelete,
  onAddVariantClick,
}: VariantsDataTableProps) {
  const filters: FilterOption[] = [
    {
      id: "status",
      label: "Status",
      value: statusFilter,
      options: [
        { label: "All Statuses", value: "all" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
    },
  ];

  const columns: ColumnDef<VariantItem>[] = [
    {
      id: "name",
      header: "Variant",
      sortable: true,
      cell: (row) => (
        <div className="font-semibold text-foreground">{row.name}</div>
      ),
    },
    {
      id: "sku",
      header: "SKU",
      sortable: false,
      cell: (row) =>
        row.sku ? (
          <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
            {row.sku}
          </code>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "price",
      header: "Price",
      sortable: true,
      cell: (row) => {
        const priceRupees = (row.price / 100).toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        return <span className="font-semibold text-xs text-foreground">₹{priceRupees}</span>;
      },
    },
    {
      id: "isActive",
      header: "Status",
      sortable: false,
      cell: (row) =>
        row.isActive ? (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="border-muted text-muted-foreground bg-muted/20">
            Inactive
          </Badge>
        ),
    },
    {
      id: "sortOrder",
      header: "Sort Order",
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.sortOrder}</span>
      ),
    },
    {
      id: "updatedAt",
      header: "Updated",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(row)}
            title="Edit variant"
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleStatus(row)}
            title={row.isActive ? "Deactivate variant" : "Activate variant"}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Power className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row)}
            title="Delete variant"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable<VariantItem>
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search variants by name or SKU..."
      filters={filters}
      onFilterChange={(id, val) => {
        if (id === "status") onStatusFilterChange(val);
      }}
      onResetFilters={() => {
        onSearchChange("");
        onStatusFilterChange("all");
      }}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={onSortChange}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      emptyTitle="No variants found"
      emptyDescription="No variants match your search criteria. Add a variant to configure options for this product."
      emptyAction={
        <Button onClick={onAddVariantClick} size="sm">
          Add Variant
        </Button>
      }
    />
  );
}

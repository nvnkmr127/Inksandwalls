"use client";

import * as React from "react";
import Link from "next/link";
import { DataTable, ColumnDef, SortDirection } from "@/components/data-table/data-table";
import { FilterOption } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Power, Layers, Image as ImageIcon } from "lucide-react";

export interface ProductCategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  productType: "PER_AREA" | "FIXED";
  isActive: boolean;
  price?: number | null; // in paise
  rate?: number | null; // in paise
  wastage?: number | null;
  minArea?: number | null;
  rollWidth?: number | null;
  returnable: boolean;
  hsnCode?: string | null;
  categoryId: string;
  category: ProductCategorySummary;
  createdAt: string;
  updatedAt: string;
}

interface ProductsDataTableProps {
  data: ProductItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categoryOptions: Array<{ label: string; value: string }>;
  sortField: string;
  sortDirection: SortDirection;
  onSortChange: (field: string) => void;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEdit: (product: ProductItem) => void;
  onToggleStatus: (product: ProductItem) => void;
  onDelete: (product: ProductItem) => void;
  onAddProductClick: () => void;
}

export function ProductsDataTable({
  data,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
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
  onAddProductClick,
}: ProductsDataTableProps) {
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
    {
      id: "productType",
      label: "Product Type",
      value: typeFilter,
      options: [
        { label: "All Types", value: "all" },
        { label: "Per Area (Wallpaper/Blinds)", value: "PER_AREA" },
        { label: "Fixed Price (Wall Art)", value: "FIXED" },
      ],
    },
    {
      id: "category",
      label: "Category",
      value: categoryFilter,
      options: [{ label: "All Categories", value: "all" }, ...categoryOptions],
    },
  ];

  const columns: ColumnDef<ProductItem>[] = [
    {
      id: "name",
      header: "Product",
      sortable: true,
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">{row.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.slug}</div>
        </div>
      ),
    },
    {
      id: "productType",
      header: "Type",
      sortable: false,
      cell: (row) =>
        row.productType === "PER_AREA" ? (
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-600 bg-cyan-500/10">
            PER_AREA
          </Badge>
        ) : (
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 bg-indigo-500/10">
            FIXED
          </Badge>
        ),
    },
    {
      id: "category",
      header: "Category",
      sortable: false,
      cell: (row) => (
        <Badge variant="secondary" className="font-normal text-xs">
          {row.category?.name || "Unassigned"}
        </Badge>
      ),
    },
    {
      id: "price",
      header: "Price / Rate",
      sortable: true,
      cell: (row) => {
        if (row.productType === "PER_AREA" && row.rate != null) {
          const rateRupees = (row.rate / 100).toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
          return (
            <div className="text-xs">
              <span className="font-semibold text-foreground">₹{rateRupees}</span>
              <span className="text-muted-foreground"> / sqft</span>
              {row.wastage ? (
                <div className="text-[10px] text-muted-foreground">
                  +{row.wastage}% wastage
                </div>
              ) : null}
            </div>
          );
        } else if (row.productType === "FIXED" && row.price != null) {
          const priceRupees = (row.price / 100).toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
          return <span className="font-semibold text-xs text-foreground">₹{priceRupees}</span>;
        }
        return <span className="text-xs text-muted-foreground">—</span>;
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
      id: "returnable",
      header: "Returnable",
      sortable: false,
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.returnable ? "Yes" : "No"}
        </span>
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
          <Link
            href={`/admin/products/${row.id}/media`}
            title="Manage product media"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <ImageIcon className="h-4 w-4" />
          </Link>
          {row.productType === "FIXED" ? (
            <Link
              href={`/admin/products/${row.id}/variants`}
              title="Manage product variants"
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              <Layers className="h-4 w-4" />
            </Link>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(row)}
            title="Edit product"
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleStatus(row)}
            title={row.isActive ? "Deactivate product" : "Activate product"}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Power className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row)}
            title="Delete product"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable<ProductItem>
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search products by name or slug..."
      filters={filters}
      onFilterChange={(id, val) => {
        if (id === "status") onStatusFilterChange(val);
        else if (id === "productType") onTypeFilterChange(val);
        else if (id === "category") onCategoryFilterChange(val);
      }}
      onResetFilters={() => {
        onSearchChange("");
        onStatusFilterChange("all");
        onTypeFilterChange("all");
        onCategoryFilterChange("all");
      }}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={onSortChange}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      emptyTitle="No products found"
      emptyDescription="No products match your criteria. Add a product to build your store catalogue."
      emptyAction={
        <Button onClick={onAddProductClick} size="sm">
          Add Product
        </Button>
      }
    />
  );
}

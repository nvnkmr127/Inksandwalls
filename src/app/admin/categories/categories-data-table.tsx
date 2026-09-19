"use client";

import * as React from "react";
import { DataTable, ColumnDef, SortDirection } from "@/components/data-table/data-table";
import { FilterOption } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Power } from "lucide-react";

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoriesDataTableProps {
  data: CategoryItem[];
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
  onEdit: (category: CategoryItem) => void;
  onToggleStatus: (category: CategoryItem) => void;
  onDelete: (category: CategoryItem) => void;
  onAddCategoryClick: () => void;
}

export function CategoriesDataTable({
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
  onAddCategoryClick,
}: CategoriesDataTableProps) {
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

  const columns: ColumnDef<CategoryItem>[] = [
    {
      id: "name",
      header: "Category Name",
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-foreground">{row.name}</div>
          {row.description && (
            <div className="text-xs text-muted-foreground truncate max-w-xs">
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "slug",
      header: "Slug",
      sortable: false,
      cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.slug}</span>,
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
      cell: (row) => <span className="font-medium text-xs">{row.sortOrder}</span>,
    },
    {
      id: "createdAt",
      header: "Created",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
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
            title="Edit category"
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleStatus(row)}
            title={row.isActive ? "Deactivate category" : "Activate category"}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Power className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row)}
            title="Delete category"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable<CategoryItem>
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search categories by name or slug..."
      filters={filters}
      onFilterChange={(_id, val) => onStatusFilterChange(val)}
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
      emptyTitle="No categories created yet"
      emptyDescription="Create your first category to organize products in the store catalogue."
      emptyAction={
        <Button onClick={onAddCategoryClick} size="sm">
          Add Category
        </Button>
      }
    />
  );
}

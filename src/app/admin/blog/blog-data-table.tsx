"use client";

import * as React from "react";
import { DataTable, ColumnDef, SortDirection } from "@/components/data-table/data-table";
import { FilterOption } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { BlogPostView } from "@/lib/blog/types";
import { useRouter } from "next/navigation";

interface BlogDataTableProps {
  data: BlogPostView[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEdit: (post: BlogPostView) => void;
  onDelete: (post: BlogPostView) => void;
  onAddClick: () => void;
}

export function BlogDataTable({
  data,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  pageIndex,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
  onAddClick,
}: BlogDataTableProps) {
  const filters: FilterOption[] = [
    {
      id: "status",
      label: "Status",
      value: statusFilter,
      options: [
        { label: "All Statuses", value: "all" },
        { label: "Published", value: "PUBLISHED" },
        { label: "Draft", value: "DRAFT" },
      ],
    },
  ];

  const columns: ColumnDef<BlogPostView>[] = [
    {
      id: "title",
      header: "Title",
      sortable: false,
      cell: (row) => (
        <div>
          <div className="font-semibold text-foreground">{row.title}</div>
          <div className="text-xs text-muted-foreground truncate max-w-xs">{row.slug}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: false,
      cell: (row) =>
        row.status === "PUBLISHED" ? (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
            Published
          </Badge>
        ) : (
          <Badge variant="outline" className="border-muted text-muted-foreground bg-muted/20">
            Draft
          </Badge>
        ),
    },
    {
      id: "publishedAt",
      header: "Published",
      sortable: false,
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      sortable: false,
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
            title="Edit post"
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row)}
            title="Delete post"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable<BlogPostView>
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by title or slug..."
      filters={filters}
      onFilterChange={(_id, val) => onStatusFilterChange(val)}
      onResetFilters={() => {
        onSearchChange("");
        onStatusFilterChange("all");
      }}
      sortField="createdAt"
      sortDirection="desc"
      onSortChange={() => {}}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      emptyTitle="No blog posts found"
      emptyDescription="Create your first blog post."
      emptyAction={
        <Button onClick={onAddClick} size="sm">
          Write Post
        </Button>
      }
    />
  );
}

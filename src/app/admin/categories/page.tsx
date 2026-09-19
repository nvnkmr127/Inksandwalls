"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { CategoriesDataTable, CategoryItem } from "./categories-data-table";
import { CategoryFormModal } from "./category-form-modal";
import { SortDirection } from "@/components/data-table/data-table";

export default function CategoriesPage() {
  const [categories, setCategories] = React.useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();

  // Filter, sort & pagination state
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortField, setSortField] = React.useState("sortOrder");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);

  // Modal states
  const [formModalOpen, setFormModalOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<CategoryItem | null>(null);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [categoryToDelete, setCategoryToDelete] = React.useState<CategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshList = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const params = new URLSearchParams();
        params.set("page", String(pageIndex + 1));
        params.set("pageSize", String(pageSize));
        if (searchValue.trim()) params.set("search", searchValue.trim());
        if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
        if (sortField) params.set("sort", sortField);
        if (sortDirection) params.set("order", sortDirection);

        const res = await fetch(`/api/admin/categories?${params.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setIsError(true);
          setErrorMessage(data.error?.message || "Failed to load categories.");
          return;
        }

        setCategories(data.items || []);
        setTotalCount(data.totalCount || 0);
      } catch {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage("Network error occurred while fetching categories.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [pageIndex, pageSize, searchValue, statusFilter, sortField, sortDirection, refreshTrigger]);



  // Handlers
  const handleSortChange = (field: string) => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else setSortDirection("asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleOpenAddModal = () => {
    setSelectedCategory(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (category: CategoryItem) => {
    setSelectedCategory(category);
    setFormModalOpen(true);
  };

  const handleToggleStatus = async (category: CategoryItem) => {
    const nextStatus = !category.isActive;
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: category.name,
          slug: category.slug,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: nextStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Status Update Failed", data.error?.message);
        return;
      }

      toast.success(
        "Status Updated",
        `Category '${category.name}' set to ${nextStatus ? "Active" : "Inactive"}.`
      );
      refreshList();
    } catch {
      toast.error("Error", "Network error updating category status.");
    }
  };

  const handleOpenDeleteConfirm = (category: CategoryItem) => {
    setCategoryToDelete(category);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/categories/${categoryToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Delete Failed", data.error?.message);
        return;
      }

      toast.success("Category Deleted", `Category '${categoryToDelete.name}' has been deleted.`);
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
      refreshList();
    } catch {
      toast.error("Error", "Network error executing category deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Manage product categories, slugs, sorting order, and active storefront visibility.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      <CategoriesDataTable
        data={categories}
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={refreshList}
        searchValue={searchValue}
        onSearchChange={(val) => {
          setSearchValue(val);
          setPageIndex(0);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => {
          setStatusFilter(val);
          setPageIndex(0);
        }}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setPageIndex}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPageIndex(0);
        }}
        onEdit={handleOpenEditModal}
        onToggleStatus={handleToggleStatus}
        onDelete={handleOpenDeleteConfirm}
        onAddCategoryClick={handleOpenAddModal}
      />

      <CategoryFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        category={selectedCategory}
        onSuccess={refreshList}
      />


      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Category"
        description={`Are you sure you want to delete category '${categoryToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete Category"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

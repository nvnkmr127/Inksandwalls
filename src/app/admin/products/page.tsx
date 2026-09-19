"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { ProductsDataTable, ProductItem } from "./products-data-table";
import { ProductFormModal } from "./product-form-modal";
import { SortDirection } from "@/components/data-table/data-table";

interface CategoryOption {
  label: string;
  value: string;
}

export default function ProductsPage() {
  const [products, setProducts] = React.useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();

  // Filter, sort & pagination state
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [sortField, setSortField] = React.useState("createdAt");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);

  // Category filter dropdown options
  const [categoryOptions, setCategoryOptions] = React.useState<CategoryOption[]>([]);

  // Modal states
  const [formModalOpen, setFormModalOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<ProductItem | null>(null);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [productToDelete, setProductToDelete] = React.useState<ProductItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshList = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Fetch category filter options once
  React.useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/admin/categories?status=active&pageSize=100");
        const data = await res.json();
        if (res.ok && Array.isArray(data.items)) {
          setCategoryOptions(
            data.items.map((c: { id: string; name: string }) => ({
              label: c.name,
              value: c.id,
            }))
          );
        }
      } catch {
        // silent fallback for category filter options
      }
    }
    loadCategories();
  }, []);

  // Load product catalogue list
  React.useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const params = new URLSearchParams();
        params.set("page", String(pageIndex + 1));
        params.set("pageSize", String(pageSize));
        if (searchValue.trim()) params.set("search", searchValue.trim());
        if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
        if (typeFilter && typeFilter !== "all") params.set("productType", typeFilter);
        if (categoryFilter && categoryFilter !== "all") params.set("categoryId", categoryFilter);
        if (sortField) params.set("sort", sortField);
        if (sortDirection) params.set("order", sortDirection);

        const res = await fetch(`/api/admin/products?${params.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setIsError(true);
          setErrorMessage(data.error?.message || "Failed to load products.");
          return;
        }

        setProducts(data.items || []);
        setTotalCount(data.totalCount || 0);
      } catch {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage("Network error occurred while fetching products.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [
    pageIndex,
    pageSize,
    searchValue,
    statusFilter,
    typeFilter,
    categoryFilter,
    sortField,
    sortDirection,
    refreshTrigger,
  ]);

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
    setSelectedProduct(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (product: ProductItem) => {
    setSelectedProduct(product);
    setFormModalOpen(true);
  };

  const handleToggleStatus = async (product: ProductItem) => {
    const nextStatus = !product.isActive;
    try {
      const payload = {
        name: product.name,
        slug: product.slug,
        description: product.description,
        productType: product.productType,
        categoryId: product.categoryId,
        isActive: nextStatus,
        returnable: product.returnable,
        hsnCode: product.hsnCode,
        price: product.price,
        rate: product.rate,
        wastage: product.wastage,
        minArea: product.minArea,
        rollWidth: product.rollWidth,
      };

      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Status Update Failed", data.error?.message);
        return;
      }

      toast.success(
        "Status Updated",
        `Product '${product.name}' set to ${nextStatus ? "Active" : "Inactive"}.`
      );
      refreshList();
    } catch {
      toast.error("Error", "Network error updating product status.");
    }
  };

  const handleOpenDeleteConfirm = (product: ProductItem) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/products/${productToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Delete Failed", data.error?.message);
        return;
      }

      toast.success("Product Deleted", `Product '${productToDelete.name}' has been deleted.`);
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
      refreshList();
    } catch {
      toast.error("Error", "Network error executing product deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage catalogue items, area-based rates, fixed pricing, category mappings, and storefront rules.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <ProductsDataTable
        data={products}
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
        typeFilter={typeFilter}
        onTypeFilterChange={(val) => {
          setTypeFilter(val);
          setPageIndex(0);
        }}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={(val) => {
          setCategoryFilter(val);
          setPageIndex(0);
        }}
        categoryOptions={categoryOptions}
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
        onAddProductClick={handleOpenAddModal}
      />

      <ProductFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        product={selectedProduct}
        onSuccess={refreshList}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Product"
        description={`Are you sure you want to delete product '${productToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete Product"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, ArrowLeft, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { VariantsDataTable, VariantItem } from "./variants-data-table";
import { VariantFormModal } from "./variant-form-modal";
import { SortDirection } from "@/components/data-table/data-table";

interface ProductInfo {
  id: string;
  name: string;
  slug: string;
  productType: "PER_AREA" | "FIXED";
}

export default function ProductVariantsPage() {
  const params = useParams();
  const productId = params.id as string;

  const [productInfo, setProductInfo] = React.useState<ProductInfo | null>(null);
  const [variants, setVariants] = React.useState<VariantItem[]>([]);
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
  const [selectedVariant, setSelectedVariant] = React.useState<VariantItem | null>(null);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [variantToDelete, setVariantToDelete] = React.useState<VariantItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshList = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Fetch product variant list
  React.useEffect(() => {
    let cancelled = false;

    async function loadVariants() {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const searchParams = new URLSearchParams();
        searchParams.set("page", String(pageIndex + 1));
        searchParams.set("pageSize", String(pageSize));
        if (searchValue.trim()) searchParams.set("search", searchValue.trim());
        if (statusFilter && statusFilter !== "all") searchParams.set("status", statusFilter);
        if (sortField) searchParams.set("sort", sortField);
        if (sortDirection) searchParams.set("order", sortDirection);

        const res = await fetch(`/api/admin/products/${productId}/variants?${searchParams.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setIsError(true);
          setErrorMessage(data.error?.message || "Failed to load variants.");
          return;
        }

        if (data.product) {
          setProductInfo(data.product);
        }
        setVariants(data.items || []);
        setTotalCount(data.totalCount || 0);
      } catch {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage("Network error occurred while fetching variants.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (productId) {
      loadVariants();
    }

    return () => {
      cancelled = true;
    };
  }, [
    productId,
    pageIndex,
    pageSize,
    searchValue,
    statusFilter,
    sortField,
    sortDirection,
    refreshTrigger,
  ]);

  const handleSortChange = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleOpenAddModal = () => {
    setSelectedVariant(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (variant: VariantItem) => {
    setSelectedVariant(variant);
    setFormModalOpen(true);
  };

  const handleToggleStatus = async (variant: VariantItem) => {
    const nextStatus = !variant.isActive;
    try {
      const payload = {
        name: variant.name,
        sku: variant.sku,
        price: variant.price,
        isActive: nextStatus,
        sortOrder: variant.sortOrder,
      };

      const res = await fetch(`/api/admin/products/${productId}/variants/${variant.id}`, {
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
        `Variant '${variant.name}' set to ${nextStatus ? "Active" : "Inactive"}.`
      );
      refreshList();
    } catch {
      toast.error("Error", "Network error updating variant status.");
    }
  };

  const handleOpenDeleteConfirm = (variant: VariantItem) => {
    setVariantToDelete(variant);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!variantToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/admin/products/${productId}/variants/${variantToDelete.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        toast.error("Delete Failed", data.error?.message);
        return;
      }

      toast.success("Variant Deleted", `Variant '${variantToDelete.name}' has been deleted.`);
      setDeleteConfirmOpen(false);
      setVariantToDelete(null);
      refreshList();
    } catch {
      toast.error("Error", "Network error executing variant deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      {/* Navigation Breadcrumb / Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/admin/products" className="hover:text-foreground flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Products
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">
            {productInfo?.name || "Product Variants"}
          </span>
          <span>/</span>
          <span>Variants</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {productInfo ? productInfo.name : "Product Variants"}
              </h1>
              {productInfo ? (
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 bg-indigo-500/10">
                  {productInfo.productType}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
              Configure options, SKUs, pricing, and sort order for this product.
            </p>
          </div>

          <Button onClick={handleOpenAddModal} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Add Variant
          </Button>
        </div>
      </div>

      <VariantsDataTable
        data={variants}
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
        onAddVariantClick={handleOpenAddModal}
      />

      <VariantFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        productId={productId}
        variant={selectedVariant}
        onSuccess={refreshList}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Variant"
        description={`Are you sure you want to delete variant '${variantToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete Variant"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

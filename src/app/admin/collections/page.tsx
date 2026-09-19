"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { CollectionsDataTable, CollectionItem } from "./collections-data-table";
import { CollectionFormModal } from "./collection-form-modal";
import { SortDirection } from "@/components/data-table/data-table";

export default function CollectionsPage() {
  const [collections, setCollections] = React.useState<CollectionItem[]>([]);
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
  const [selectedCollection, setSelectedCollection] = React.useState<CollectionItem | null>(null);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [collectionToDelete, setCollectionToDelete] = React.useState<CollectionItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshList = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCollections() {
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

        const res = await fetch(`/api/admin/collections?${params.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setIsError(true);
          setErrorMessage(data.error?.message || "Failed to load collections.");
          return;
        }

        setCollections(data.items || []);
        setTotalCount(data.totalCount || 0);
      } catch {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage("Network error occurred while fetching collections.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCollections();

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
    setSelectedCollection(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (collection: CollectionItem) => {
    setSelectedCollection(collection);
    setFormModalOpen(true);
  };

  const handleToggleStatus = async (collection: CollectionItem) => {
    const nextStatus = !collection.isActive;
    try {
      const res = await fetch(`/api/admin/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          sortOrder: collection.sortOrder,
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
        `Collection '${collection.name}' set to ${nextStatus ? "Active" : "Inactive"}.`
      );
      refreshList();
    } catch {
      toast.error("Error", "Network error updating collection status.");
    }
  };

  const handleOpenDeleteConfirm = (collection: CollectionItem) => {
    setCollectionToDelete(collection);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!collectionToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/collections/${collectionToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Delete Failed", data.error?.message);
        return;
      }

      toast.success("Collection Deleted", `Collection '${collectionToDelete.name}' has been deleted.`);
      setDeleteConfirmOpen(false);
      setCollectionToDelete(null);
      refreshList();
    } catch {
      toast.error("Error", "Network error executing collection deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Manage product collections, slugs, display sorting, and active storefront visibility.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Add Collection
        </Button>
      </div>

      <CollectionsDataTable
        data={collections}
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
        onAddCollectionClick={handleOpenAddModal}
      />

      <CollectionFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        collection={selectedCollection}
        onSuccess={refreshList}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Collection"
        description={`Are you sure you want to delete collection '${collectionToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete Collection"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { PageDataTable } from "./page-data-table";
import { PageView } from "@/lib/pages/types";
import { useRouter } from "next/navigation";

export default function PageAdminPage() {
  const router = useRouter();
  const [pages, setPages] = React.useState<PageView[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();

  // Filter & pagination state
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [pageToDelete, setPageToDelete] = React.useState<PageView | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshList = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPages() {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const params = new URLSearchParams();
        params.set("page", String(pageIndex + 1));
        params.set("limit", String(pageSize));
        if (searchValue.trim()) params.set("search", searchValue.trim());
        if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);

        const res = await fetch(`/api/admin/pages?${params.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setIsError(true);
          setErrorMessage(data.error?.message || "Failed to load pages.");
          return;
        }

        setPages(data.data || []);
        setTotalCount(data.metadata?.total || 0);
      } catch {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage("Network error occurred while fetching pages.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPages();

    return () => {
      cancelled = true;
    };
  }, [pageIndex, pageSize, searchValue, statusFilter, refreshTrigger]);

  const handleOpenDeleteConfirm = (page: PageView) => {
    setPageToDelete(page);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pageToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/pages/${pageToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error("Delete Failed", data.error?.message);
        return;
      }

      toast.success("Page Deleted", `Page '${pageToDelete.title}' has been deleted.`);
      setDeleteConfirmOpen(false);
      setPageToDelete(null);
      refreshList();
    } catch {
      toast.error("Error", "Network error executing deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Manage page content, articles, and publication statuses.
          </p>
        </div>
        <Button onClick={() => router.push("/admin/pages/new")} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Write Page
        </Button>
      </div>

      <PageDataTable
        data={pages}
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
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setPageIndex}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPageIndex(0);
        }}
        onEdit={(page) => router.push(`/admin/pages/${page.id}`)}
        onDelete={handleOpenDeleteConfirm}
        onAddClick={() => router.push("/admin/pages/new")}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Page"
        description={`Are you sure you want to delete '${pageToDelete?.title}'? This action cannot be undone.`}
        confirmText="Delete Page"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

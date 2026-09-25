"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { EnquiriesDataTable, EnquiryItem } from "./enquiries-data-table";
import { SortDirection } from "@/components/data-table/data-table";

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = React.useState<EnquiryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();

  // Filter, sort & pagination state
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortField, setSortField] = React.useState("createdAt");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [enquiryToDelete, setEnquiryToDelete] = React.useState<EnquiryItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshList = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadEnquiries() {
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

        const res = await fetch(`/api/admin/enquiries?${params.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setIsError(true);
          setErrorMessage(data.error?.message || "Failed to load enquiries.");
          return;
        }

        setEnquiries(data.items || []);
        setTotalCount(data.totalCount || 0);
      } catch {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage("Network error occurred while fetching enquiries.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadEnquiries();

    return () => {
      cancelled = true;
    };
  }, [pageIndex, pageSize, searchValue, statusFilter, sortField, sortDirection, refreshTrigger]);

  const handleSortChange = (field: string) => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else setSortDirection("asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleUpdateStatus = async (enquiry: EnquiryItem, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/enquiries/${enquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Update Failed", data.error?.message);
        return;
      }

      toast.success("Status Updated", `Enquiry status changed to ${newStatus}.`);
      refreshList();
    } catch {
      toast.error("Error", "Network error updating enquiry status.");
    }
  };

  const handleOpenDeleteConfirm = (enquiry: EnquiryItem) => {
    setEnquiryToDelete(enquiry);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!enquiryToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/enquiries/${enquiryToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Delete Failed", data.error?.message);
        return;
      }

      toast.success("Enquiry Deleted", `Enquiry from '${enquiryToDelete.name}' has been deleted.`);
      setDeleteConfirmOpen(false);
      setEnquiryToDelete(null);
      refreshList();
    } catch {
      toast.error("Error", "Network error executing enquiry deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Consultation Enquiries</h1>
        <p className="text-sm text-muted-foreground">
          View and manage consultation requests from customers.
        </p>
      </div>

      <EnquiriesDataTable
        data={enquiries}
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
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleOpenDeleteConfirm}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Enquiry"
        description={`Are you sure you want to delete the enquiry from '${enquiryToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete Enquiry"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

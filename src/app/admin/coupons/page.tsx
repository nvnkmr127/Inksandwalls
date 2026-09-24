"use client";

import * as React from "react";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { CouponsDataTable, CouponItem } from "./coupons-data-table";
import { CouponFormModal } from "./coupon-form-modal";
import { CouponDetailModal } from "./coupon-detail-modal";
import { SortDirection } from "@/components/data-table/data-table";

export default function CouponsAdminPage() {
  const [coupons, setCoupons] = React.useState<CouponItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();

  // Filter, sort & pagination state
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [sortField, setSortField] = React.useState("createdAt");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);

  // Form modal states
  const [formModalOpen, setFormModalOpen] = React.useState(false);
  const [selectedCoupon, setSelectedCoupon] = React.useState<CouponItem | null>(null);

  // Detail modal states
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);
  const [detailCouponId, setDetailCouponId] = React.useState<string | null>(null);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [couponToDelete, setCouponToDelete] = React.useState<CouponItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const refreshList = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCoupons() {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const params = new URLSearchParams();
        params.set("page", String(pageIndex + 1));
        params.set("pageSize", String(pageSize));
        if (searchValue.trim()) params.set("search", searchValue.trim());
        if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
        if (typeFilter && typeFilter !== "all") params.set("discountType", typeFilter);
        if (sortField) params.set("sort", sortField);
        if (sortDirection) params.set("order", sortDirection);

        const res = await fetch(`/api/admin/coupons?${params.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setIsError(true);
          setErrorMessage(data.error?.message || "Failed to load coupons.");
          return;
        }

        setCoupons(data.items || []);
        setTotalCount(data.totalCount || 0);
      } catch {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage("Network error occurred while fetching coupons.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCoupons();

    return () => {
      cancelled = true;
    };
  }, [
    pageIndex,
    pageSize,
    searchValue,
    statusFilter,
    typeFilter,
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
    setSelectedCoupon(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (coupon: CouponItem) => {
    setSelectedCoupon(coupon);
    setFormModalOpen(true);
  };

  const handleViewDetails = (coupon: CouponItem) => {
    setDetailCouponId(coupon.id);
    setDetailModalOpen(true);
  };

  const handleToggleStatus = async (coupon: CouponItem) => {
    const nextStatus = !coupon.isActive;
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minCartValuePaise: coupon.minCartValuePaise,
          maxDiscountPaise: coupon.maxDiscountPaise,
          startDate: coupon.startDate,
          expiryDate: coupon.expiryDate,
          usageLimit: coupon.usageLimit,
          perCustomerLimit: coupon.perCustomerLimit,
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
        `Coupon '${coupon.code}' set to ${nextStatus ? "Active" : "Inactive"}.`
      );
      refreshList();
    } catch {
      toast.error("Error", "Network error updating coupon status.");
    }
  };

  const handleOpenDeleteConfirm = (coupon: CouponItem) => {
    setCouponToDelete(coupon);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!couponToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/coupons/${couponToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Delete Failed", data.error?.message);
        return;
      }

      toast.success("Coupon Deleted", `Coupon '${couponToDelete.code}' has been deleted.`);
      setDeleteConfirmOpen(false);
      setCouponToDelete(null);
      refreshList();
    } catch {
      toast.error("Error", "Network error executing coupon deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            Coupons & Promotions
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage promotional discount codes, validity windows, minimum cart thresholds, and customer redemption limits.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Create Coupon
        </Button>
      </div>

      <CouponsDataTable
        data={coupons}
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
        onViewDetails={handleViewDetails}
        onEdit={handleOpenEditModal}
        onToggleStatus={handleToggleStatus}
        onDelete={handleOpenDeleteConfirm}
        onAddCouponClick={handleOpenAddModal}
      />

      <CouponFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        coupon={selectedCoupon}
        onSuccess={refreshList}
      />

      <CouponDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        couponId={detailCouponId}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Coupon"
        description={`Are you sure you want to delete coupon '${couponToDelete?.code}'? If this coupon has been used in past customer carts, it cannot be deleted.`}
        confirmText="Delete Coupon"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

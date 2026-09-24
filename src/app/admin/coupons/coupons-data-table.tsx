"use client";

import * as React from "react";
import { DiscountType } from "@prisma/client";
import { DataTable, ColumnDef, SortDirection } from "@/components/data-table/data-table";
import { FilterOption } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPaiseToRupees } from "@/lib/money";
import { Edit2, Trash2, Power, Eye } from "lucide-react";

export interface CouponItem {
  id: string;
  code: string;
  discountType: DiscountType | string;
  discountValue: number;
  minCartValuePaise?: number | null;
  maxDiscountPaise?: number | null;
  startDate?: string | null;
  expiryDate?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  currentUsageCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CouponsDataTableProps {
  data: CouponItem[];
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
  sortField: string;
  sortDirection: SortDirection;
  onSortChange: (field: string) => void;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onViewDetails: (coupon: CouponItem) => void;
  onEdit: (coupon: CouponItem) => void;
  onToggleStatus: (coupon: CouponItem) => void;
  onDelete: (coupon: CouponItem) => void;
  onAddCouponClick: () => void;
}

export function CouponsDataTable({
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
  sortField,
  sortDirection,
  onSortChange,
  pageIndex,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onViewDetails,
  onEdit,
  onToggleStatus,
  onDelete,
  onAddCouponClick,
}: CouponsDataTableProps) {
  const filters: FilterOption[] = [
    {
      id: "status",
      label: "Status",
      value: statusFilter,
      options: [
        { label: "All Statuses", value: "all" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Expired", value: "expired" },
        { label: "Upcoming", value: "upcoming" },
      ],
    },
    {
      id: "type",
      label: "Discount Type",
      value: typeFilter,
      options: [
        { label: "All Types", value: "all" },
        { label: "Percentage (%)", value: "PERCENTAGE" },
        { label: "Fixed Amount (₹)", value: "FIXED_AMOUNT" },
      ],
    },
  ];

  const now = new Date();

  const columns: ColumnDef<CouponItem>[] = [
    {
      id: "code",
      header: "Coupon Code",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold tracking-wider text-sm px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      id: "discountValue",
      header: "Discount",
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-foreground">
            {row.discountType === DiscountType.PERCENTAGE
              ? `${row.discountValue}% OFF`
              : `${formatPaiseToRupees(row.discountValue)} OFF`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {row.discountType === DiscountType.PERCENTAGE ? "Percentage" : "Fixed Amount"}
          </div>
        </div>
      ),
    },
    {
      id: "minCartValuePaise",
      header: "Min Cart",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-foreground font-medium">
          {row.minCartValuePaise ? formatPaiseToRupees(row.minCartValuePaise) : "—"}
        </span>
      ),
    },
    {
      id: "maxDiscountPaise",
      header: "Max Discount",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-foreground font-medium">
          {row.maxDiscountPaise ? formatPaiseToRupees(row.maxDiscountPaise) : "—"}
        </span>
      ),
    },
    {
      id: "expiryDate",
      header: "Validity",
      sortable: true,
      cell: (row) => {
        const start = row.startDate ? new Date(row.startDate).toLocaleDateString() : null;
        const expiry = row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : null;

        if (!start && !expiry) {
          return <span className="text-xs text-muted-foreground">Always Valid</span>;
        }

        return (
          <div className="text-xs space-y-0.5">
            {start && <div className="text-muted-foreground">From: {start}</div>}
            {expiry ? (
              <div className={new Date(row.expiryDate!) < now ? "text-destructive font-medium" : "text-foreground"}>
                Exp: {expiry}
              </div>
            ) : (
              <div className="text-muted-foreground">No Expiry</div>
            )}
          </div>
        );
      },
    },
    {
      id: "currentUsageCount",
      header: "Usage",
      sortable: true,
      cell: (row) => {
        const hasLimit = row.usageLimit != null;
        const isDepleted = hasLimit && row.currentUsageCount >= row.usageLimit!;
        return (
          <div>
            <div className={`text-xs font-semibold ${isDepleted ? "text-rose-600" : "text-foreground"}`}>
              {row.currentUsageCount} / {hasLimit ? row.usageLimit : "∞"}
            </div>
            {row.perCustomerLimit && (
              <div className="text-[10px] text-muted-foreground">
                Max {row.perCustomerLimit}/customer
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "isActive",
      header: "Status",
      sortable: true,
      cell: (row) => {
        const isExpired = row.expiryDate ? new Date(row.expiryDate) < now : false;
        const isUpcoming = row.startDate ? new Date(row.startDate) > now : false;
        const isDepleted = row.usageLimit != null && row.currentUsageCount >= row.usageLimit;

        if (!row.isActive) {
          return (
            <Badge variant="outline" className="border-muted text-muted-foreground bg-muted/20">
              Inactive
            </Badge>
          );
        }

        if (isExpired) {
          return (
            <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10">
              Expired
            </Badge>
          );
        }

        if (isUpcoming) {
          return (
            <Badge variant="outline" className="border-blue-500/30 text-blue-500 bg-blue-500/10">
              Upcoming
            </Badge>
          );
        }

        if (isDepleted) {
          return (
            <Badge variant="outline" className="border-rose-500/30 text-rose-600 bg-rose-500/10">
              Depleted
            </Badge>
          );
        }

        return (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
            Active
          </Badge>
        );
      },
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
            onClick={() => onViewDetails(row)}
            title="View coupon details & usages"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(row)}
            title="Edit coupon"
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleStatus(row)}
            title={row.isActive ? "Deactivate coupon" : "Activate coupon"}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Power className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row)}
            title="Delete coupon"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable<CouponItem>
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search coupons by code..."
      filters={filters}
      onFilterChange={(filterId, val) => {
        if (filterId === "status") onStatusFilterChange(val);
        if (filterId === "type") onTypeFilterChange(val);
      }}
      onResetFilters={() => {
        onSearchChange("");
        onStatusFilterChange("all");
        onTypeFilterChange("all");
      }}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={onSortChange}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      emptyTitle="No coupons found"
      emptyDescription="Create discount coupons to offer promotions and incentives to your shoppers."
      emptyAction={
        <Button onClick={onAddCouponClick} size="sm">
          Create Coupon
        </Button>
      }
    />
  );
}

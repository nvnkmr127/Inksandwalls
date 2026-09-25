"use client";

import * as React from "react";
import Link from "next/link";
import { DataTable, ColumnDef, SortDirection } from "@/components/data-table/data-table";
import { FilterOption } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { PaymentStatus, FulfillmentStatus, PaymentMethod } from "@prisma/client";


export interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalPaise: number;
  invoiceUrl?: string | null;
  createdAt: string;
}

interface OrdersDataTableProps {
  data: OrderItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  paymentStatusFilter: string;
  onPaymentStatusFilterChange: (value: string) => void;
  fulfillmentStatusFilter: string;
  onFulfillmentStatusFilterChange: (value: string) => void;
  paymentMethodFilter: string;
  onPaymentMethodFilterChange: (value: string) => void;
  sortField: string;
  sortDirection: SortDirection;
  onSortChange: (field: string) => void;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const formatCurrency = (paise: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
};

export function OrdersDataTable({
  data,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  searchValue,
  onSearchChange,
  paymentStatusFilter,
  onPaymentStatusFilterChange,
  fulfillmentStatusFilter,
  onFulfillmentStatusFilterChange,
  paymentMethodFilter,
  onPaymentMethodFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  pageIndex,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: OrdersDataTableProps) {
  const columns = React.useMemo<ColumnDef<OrderItem>[]>(
    () => [
      {
        id: "orderNumber",
        header: "Order Number",
        sortable: true,
        cell: (row) => (
          <div className="font-medium text-foreground">
            {row.orderNumber}
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        sortable: false,
        cell: (row) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.customerName}</span>
            <span className="text-xs text-muted-foreground">{row.customerEmail}</span>
          </div>
        ),
      },
      {
        id: "createdAt",
        header: "Date",
        sortable: true,
        cell: (row) => (
          <div className="text-sm">
            {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(row.createdAt))}
          </div>
        ),
      },
      {
        id: "paymentStatus",
        header: "Payment",
        sortable: false,
        cell: (row) => {
          let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
          if (row.paymentStatus === "PAID") variant = "default";
          else if (row.paymentStatus === "FAILED") variant = "destructive";
          else if (row.paymentStatus === "PENDING") variant = "secondary";

          return <Badge variant={variant}>{row.paymentStatus}</Badge>;
        },
      },
      {
        id: "fulfillmentStatus",
        header: "Fulfillment",
        sortable: false,
        cell: (row) => {
          let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
          if (row.fulfillmentStatus === "DELIVERED") variant = "default";
          else if (row.fulfillmentStatus === "CANCELLED") variant = "destructive";
          else if (row.fulfillmentStatus === "CONFIRMED") variant = "secondary";

          return <Badge variant={variant}>{row.fulfillmentStatus.replace(/_/g, " ")}</Badge>;
        },
      },
      {
        id: "totalPaise",
        header: "Total",
        sortable: true,
        cell: (row) => (
          <div className="font-medium">{formatCurrency(row.totalPaise)}</div>
        ),
      },
      {
        id: "actions",
        header: "Invoice",
        sortable: false,
        cell: (row) => (
          <div className="flex items-center gap-2">
            {row.invoiceUrl ? (
              <a
                href={row.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1 text-sm"
              >
                <FileText className="w-4 h-4" />
                View
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const filters: FilterOption[] = [
    {
      id: "paymentStatus",
      label: "Payment Status",
      value: paymentStatusFilter,
      options: [
        { label: "All Payment Statuses", value: "all" },
        ...Object.values(PaymentStatus).map((s) => ({ label: s, value: s })),
      ],
    },
    {
      id: "fulfillmentStatus",
      label: "Fulfillment Status",
      value: fulfillmentStatusFilter,
      options: [
        { label: "All Fulfillment Statuses", value: "all" },
        ...Object.values(FulfillmentStatus).map((s) => ({ label: s.replace(/_/g, " "), value: s })),
      ],
    },
    {
      id: "paymentMethod",
      label: "Payment Method",
      value: paymentMethodFilter,
      options: [
        { label: "All Methods", value: "all" },
        ...Object.values(PaymentMethod).map((m) => ({ label: m, value: m })),
      ],
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by order number or customer..."
      filters={filters}
      onFilterChange={(filterId, value) => {
        if (filterId === "paymentStatus") onPaymentStatusFilterChange(value);
        else if (filterId === "fulfillmentStatus") onFulfillmentStatusFilterChange(value);
        else if (filterId === "paymentMethod") onPaymentMethodFilterChange(value);
      }}
      onResetFilters={() => {
        onPaymentStatusFilterChange("all");
        onFulfillmentStatusFilterChange("all");
        onPaymentMethodFilterChange("all");
      }}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={onSortChange}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      emptyTitle="No orders found"
      emptyDescription="Try adjusting your search or filters."
    />
  );
}

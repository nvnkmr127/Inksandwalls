"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { OrdersDataTable, OrderItem } from "./orders-data-table";
import { SortDirection } from "@/components/data-table/data-table";

function OrdersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [orders, setOrders] = React.useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();
  const [totalCount, setTotalCount] = React.useState(0);

  const searchValue = searchParams.get("search") || "";
  const paymentStatusFilter = searchParams.get("paymentStatus") || "all";
  const fulfillmentStatusFilter = searchParams.get("fulfillmentStatus") || "all";
  const paymentMethodFilter = searchParams.get("paymentMethod") || "all";
  const sortField = searchParams.get("sort") || "createdAt";
  const sortDirection = (searchParams.get("order") as SortDirection) || "desc";
  const pageIndex = parseInt(searchParams.get("page") || "1", 10) - 1;
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

  const updateUrl = React.useCallback(
    (newParams: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const fetchOrders = React.useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(undefined);

    try {
      const params = new URLSearchParams();
      params.set("page", String(pageIndex + 1));
      params.set("pageSize", String(pageSize));
      if (searchValue) params.set("search", searchValue);
      if (paymentStatusFilter !== "all") params.set("paymentStatus", paymentStatusFilter);
      if (fulfillmentStatusFilter !== "all") params.set("fulfillmentStatus", fulfillmentStatusFilter);
      if (paymentMethodFilter !== "all") params.set("paymentMethod", paymentMethodFilter);
      if (sortField) params.set("sort", sortField);
      if (sortDirection) params.set("order", sortDirection);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setIsError(true);
        setErrorMessage(data.error || "Failed to load orders");
        return;
      }

      setOrders(data.orders);
      setTotalCount(data.totalCount);
    } catch (err: any) {
      setIsError(true);
      setErrorMessage(err.message || "Network error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [
    pageIndex,
    pageSize,
    searchValue,
    paymentStatusFilter,
    fulfillmentStatusFilter,
    paymentMethodFilter,
    sortField,
    sortDirection,
  ]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage and track all store orders and fulfillments.
        </p>
      </div>

      <OrdersDataTable
        data={orders}
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={fetchOrders}
        searchValue={searchValue}
        onSearchChange={(v) => updateUrl({ search: v, page: 1 })}
        paymentStatusFilter={paymentStatusFilter}
        onPaymentStatusFilterChange={(v) => updateUrl({ paymentStatus: v, page: 1 })}
        fulfillmentStatusFilter={fulfillmentStatusFilter}
        onFulfillmentStatusFilterChange={(v) => updateUrl({ fulfillmentStatus: v, page: 1 })}
        paymentMethodFilter={paymentMethodFilter}
        onPaymentMethodFilterChange={(v) => updateUrl({ paymentMethod: v, page: 1 })}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field) => {
          if (field === sortField) {
            updateUrl({ order: sortDirection === "asc" ? "desc" : "asc", page: 1 });
          } else {
            updateUrl({ sort: field, order: "asc", page: 1 });
          }
        }}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={(page) => updateUrl({ page: page + 1 })}
        onPageSizeChange={(size) => updateUrl({ pageSize: size, page: 1 })}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <OrdersPageContent />
    </React.Suspense>
  );
}

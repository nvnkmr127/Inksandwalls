"use client";

import * as React from "react";
import { DataTable, ColumnDef, SortDirection } from "@/components/data-table/data-table";
import { FilterOption } from "@/components/data-table/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare } from "lucide-react";

export interface EnquiryItem {
  id: string;
  name: string;
  phone: string;
  message?: string | null;
  status: string;
  createdAt: string;
}

interface EnquiriesDataTableProps {
  data: EnquiryItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortField: string;
  sortDirection: SortDirection;
  onSortChange: (field: string) => void;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onUpdateStatus: (enquiry: EnquiryItem, newStatus: string) => void;
  onDelete: (enquiry: EnquiryItem) => void;
}

export function EnquiriesDataTable({
  data,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  pageIndex,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onUpdateStatus,
  onDelete,
}: EnquiriesDataTableProps) {
  const filters: FilterOption[] = [
    {
      id: "status",
      label: "Status",
      value: statusFilter,
      options: [
        { label: "All Statuses", value: "all" },
        { label: "New", value: "new" },
        { label: "In Progress", value: "in_progress" },
        { label: "Closed", value: "closed" },
      ],
    },
  ];

  const columns: ColumnDef<EnquiryItem>[] = [
    {
      id: "name",
      header: "Contact",
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-foreground">{row.name}</div>
          <div className="text-xs text-muted-foreground">{row.phone}</div>
        </div>
      ),
    },
    {
      id: "message",
      header: "Message",
      sortable: false,
      cell: (row) => (
        <div className="text-sm text-muted-foreground truncate max-w-[200px]" title={row.message || ""}>
          {row.message || <span className="italic">No message</span>}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: false,
      cell: (row) => (
        <select
          value={row.status.toLowerCase()}
          onChange={(e) => onUpdateStatus(row, e.target.value.toUpperCase())}
          className="text-xs p-1 border rounded bg-background"
        >
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
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
            onClick={() => window.open(`https://wa.me/${row.phone.replace(/\\D/g,'')}`, '_blank')}
            title="Chat on WhatsApp"
            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row)}
            title="Delete enquiry"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable<EnquiryItem>
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by name, phone, or message..."
      filters={filters}
      onFilterChange={(_id, val) => onStatusFilterChange(val)}
      onResetFilters={() => {
        onSearchChange("");
        onStatusFilterChange("all");
      }}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={onSortChange}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      emptyTitle="No enquiries found"
      emptyDescription="Consultation requests from customers will appear here."
    />
  );
}

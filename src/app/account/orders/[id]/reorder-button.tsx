"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reorderOrderAction } from "@/app/actions/order";
import { toast } from "sonner";

export function ReorderButton({ orderNumber }: { orderNumber: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleReorder = async () => {
    setIsLoading(true);
    try {
      const result = await reorderOrderAction(orderNumber);
      if (result.success) {
        toast.success("Items added to cart");
        router.push("/cart");
      } else {
        toast.error(result.error || "Failed to reorder");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleReorder}
      disabled={isLoading}
      className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
    >
      {isLoading ? "Processing..." : "Re-order"}
    </button>
  );
}

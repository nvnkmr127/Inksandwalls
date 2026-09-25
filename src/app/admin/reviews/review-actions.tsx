"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateReviewStatus } from "@/app/actions/admin-review";
import { toast } from "sonner";
import { Check, X, Clock } from "lucide-react";

interface ReviewActionsProps {
  reviewId: string;
  currentStatus: "PENDING" | "APPROVED" | "REJECTED";
}

export function ReviewActions({ reviewId, currentStatus }: ReviewActionsProps) {
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (status: "PENDING" | "APPROVED" | "REJECTED") => {
    setLoading(true);
    try {
      const result = await updateReviewStatus({ reviewId, status });
      if (result.success) {
        toast.success(`Review marked as ${status.toLowerCase()}`);
      } else {
        toast.error(result.error || "Failed to update status");
      }
    } catch (error) {
      toast.error("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {currentStatus !== "APPROVED" && (
        <Button
          size="sm"
          variant="outline"
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={() => handleUpdate("APPROVED")}
          disabled={loading}
        >
          <Check className="h-4 w-4 mr-1" /> Approve
        </Button>
      )}
      {currentStatus !== "REJECTED" && (
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => handleUpdate("REJECTED")}
          disabled={loading}
        >
          <X className="h-4 w-4 mr-1" /> Reject
        </Button>
      )}
      {currentStatus !== "PENDING" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleUpdate("PENDING")}
          disabled={loading}
        >
          <Clock className="h-4 w-4 mr-1" /> Reset to Pending
        </Button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { FulfillmentStatus } from "@prisma/client";
import { updateOrderFulfillmentAction } from "@/app/actions/admin-fulfillment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FULFILLMENT_STATUS_TRANSITIONS } from "@/lib/order/status";

interface FulfillmentActionsProps {
  orderId: string;
  currentStatus: FulfillmentStatus;
}

const STATUS_LABELS: Partial<Record<FulfillmentStatus, string>> = {
  [FulfillmentStatus.IN_PRODUCTION]: "Start Production",
  [FulfillmentStatus.READY_TO_SHIP]: "Mark Ready to Ship",
  [FulfillmentStatus.SHIPPED]: "Mark Shipped",
  [FulfillmentStatus.DELIVERED]: "Mark Delivered",
  [FulfillmentStatus.CANCELLED]: "Cancel Order",
  [FulfillmentStatus.RETURN_REQUESTED]: "Request Return",
  [FulfillmentStatus.RETURNED]: "Mark Returned",
};

export function FulfillmentActions({ orderId, currentStatus }: FulfillmentActionsProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<FulfillmentStatus | null>(null);

  const availableTransitions = FULFILLMENT_STATUS_TRANSITIONS[currentStatus] || [];

  const handleTransition = async (nextStatus: FulfillmentStatus) => {
    setIsPending(true);
    setError(null);
    try {
      const result = await updateOrderFulfillmentAction(orderId, nextStatus);
      if (!result.success) {
        setError(result.error || "An error occurred");
      } else {
        setOpenDialog(null);
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Badge variant="outline" className="text-sm px-3 py-1 mb-4">
          {currentStatus.replace(/_/g, " ")}
        </Badge>
      </div>

      {availableTransitions.length > 0 && (
        <div className="flex flex-col gap-2">
          {availableTransitions.map((nextStatus) => {
            const label = STATUS_LABELS[nextStatus] || nextStatus;
            const isDestructive = nextStatus === "CANCELLED" || nextStatus === "RETURN_REQUESTED";

            return (
              <Dialog
                key={nextStatus}
                open={openDialog === nextStatus}
                onOpenChange={(open) => {
                  if (open) {
                    setOpenDialog(nextStatus);
                    setError(null);
                  } else {
                    setOpenDialog(null);
                  }
                }}
              >
                <DialogTrigger>
                  <Button variant={isDestructive ? "destructive" : "default"} size="sm" type="button">
                    {label}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Status Change</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to change the fulfillment status to{" "}
                      <strong>{nextStatus.replace(/_/g, " ")}</strong>?
                    </DialogDescription>
                  </DialogHeader>
                  {error && <div className="text-destructive text-sm font-medium">{error}</div>}
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setOpenDialog(null)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant={isDestructive ? "destructive" : "default"}
                      onClick={() => handleTransition(nextStatus)}
                      disabled={isPending}
                    >
                      {isPending ? "Saving..." : "Confirm"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      )}
    </div>
  );
}

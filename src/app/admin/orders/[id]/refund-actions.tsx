"use client";

import { useState } from "react";
import { processRefundAction } from "@/app/actions/admin-refund";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RefundActionsProps {
  orderId: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmountPaise: number;
  alreadyRefundedPaise: number;
}

export function RefundActions({
  orderId,
  paymentMethod,
  paymentStatus,
  totalAmountPaise,
  alreadyRefundedPaise,
}: RefundActionsProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  
  const maxRefundable = totalAmountPaise - alreadyRefundedPaise;
  const [refundAmountStr, setRefundAmountStr] = useState<string>((maxRefundable / 100).toString());

  if (paymentMethod !== "RAZORPAY" || paymentStatus !== "PAID") {
    return null;
  }

  if (maxRefundable <= 0) {
    return (
      <div className="text-sm text-muted-foreground italic mt-4">
        Order has been fully refunded.
      </div>
    );
  }

  const handleRefund = async () => {
    setIsPending(true);
    setError(null);
    try {
      const amount = parseFloat(refundAmountStr);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid refund amount");
      }
      const amountPaise = Math.round(amount * 100);
      if (amountPaise > maxRefundable) {
        throw new Error("Amount exceeds maximum refundable amount");
      }

      const result = await processRefundAction(orderId, amountPaise);
      if (!result.success) {
        setError(result.error || "An error occurred");
      } else {
        setOpen(false);
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mt-4">
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            setOpen(true);
            setError(null);
            setRefundAmountStr((maxRefundable / 100).toString());
          } else {
            setOpen(false);
          }
        }}
      >
        <DialogTrigger>
          <Button variant="outline" size="sm" type="button">
            Issue Refund
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Refund (Razorpay)</DialogTitle>
            <DialogDescription>
              This will process a refund via Razorpay for the verified payment on this order.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold block">Total Paid</span>
                ₹{(totalAmountPaise / 100).toFixed(2)}
              </div>
              <div>
                <span className="font-semibold block">Already Refunded</span>
                ₹{(alreadyRefundedPaise / 100).toFixed(2)}
              </div>
              <div>
                <span className="font-semibold block">Max Refundable</span>
                ₹{(maxRefundable / 100).toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refundAmount">Refund Amount (₹)</Label>
              <Input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={(maxRefundable / 100).toFixed(2)}
                value={refundAmountStr}
                onChange={(e) => setRefundAmountStr(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="text-destructive text-sm font-medium">{error}</div>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={isPending}
            >
              {isPending ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

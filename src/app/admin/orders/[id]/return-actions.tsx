"use client";

import { useState } from "react";
import { FulfillmentStatus } from "@prisma/client";
import { AdminOrderDetail } from "@/lib/order/admin-order-detail-service";
import { checkReturnEligibility } from "@/lib/order/return-service";
import { requestReturnAction, completeReturnAction } from "@/app/actions/admin-returns";

export function ReturnActions({ order }: { order: AdminOrderDetail }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibility = checkReturnEligibility(order, order.items);
  const { eligible, reason, returnableItems, nonReturnableItems } = eligibility;
  const isReturnRequested = order.fulfillmentStatus === FulfillmentStatus.RETURN_REQUESTED;
  const isReturned = order.fulfillmentStatus === FulfillmentStatus.RETURNED;

  const handleRequestReturn = async () => {
    if (!confirm("Are you sure you want to request a return for this order?")) return;
    setLoading(true);
    setError(null);
    const result = await requestReturnAction(order.id);
    if (!result.success) {
      setError(result.error || "Failed to request return");
    }
    setLoading(false);
  };

  const handleCompleteReturn = async () => {
    if (!confirm("Are you sure you want to mark this return as complete?")) return;
    setLoading(true);
    setError(null);
    const result = await completeReturnAction(order.id);
    if (!result.success) {
      setError(result.error || "Failed to complete return");
    }
    setLoading(false);
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm mt-6">
      <div className="flex flex-col space-y-1.5 p-6 border-b">
        <h3 className="font-semibold leading-none tracking-tight">Returns</h3>
      </div>
      <div className="p-6 pt-4 space-y-4">
        {error && (
          <div className="text-sm font-medium text-destructive">{error}</div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Return Eligibility: {eligible ? "Eligible" : "Not Eligible"}</h4>
          {!eligible && reason && (
            <p className="text-sm text-muted-foreground">{reason}</p>
          )}
        </div>

        {returnableItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Returnable Items</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside">
              {returnableItems.map(item => (
                <li key={item.id}>{item.productName} (x{item.quantity})</li>
              ))}
            </ul>
          </div>
        )}

        {nonReturnableItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-destructive">Non-Returnable Items</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside">
              {nonReturnableItems.map(item => (
                <li key={item.id}>{item.productName} (x{item.quantity})</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex space-x-2 pt-4">
          {eligible && (
            <button
              onClick={handleRequestReturn}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              {loading ? "Processing..." : "Request Return"}
            </button>
          )}
          {isReturnRequested && (
            <button
              onClick={handleCompleteReturn}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              {loading ? "Processing..." : "Mark as Returned"}
            </button>
          )}
          {isReturned && (
            <div className="text-sm font-medium text-green-600">
              Return Processed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

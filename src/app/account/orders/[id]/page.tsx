import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerOrderByNumber } from "@/lib/order/order-list-service";
import { formatPaiseToRupees } from "@/lib/money";
import { reorderOrderAction } from "@/app/actions/order";
import { ReorderButton } from "./reorder-button"; // Client component
import { ReviewButton } from "./review-button";

export const metadata: Metadata = {
  title: "Order Detail | INKs & Walls",
};

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let order;
  try {
    order = await getCustomerOrderByNumber(params.id);
  } catch (error) {
    notFound();
  }

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/account/orders" className="text-sm text-primary hover:underline mb-2 inline-block">
            &larr; Back to Orders
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Order #{order.orderNumber}</h1>
          <p className="text-muted-foreground">
            Placed on {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex gap-2">
          {order.invoiceUrl && (
            <a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
              View Invoice
            </a>
          )}
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
              Track Order
            </a>
          )}
          <ReorderButton orderNumber={order.orderNumber} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-lg border">
            <div className="p-4 border-b font-medium bg-muted/50">Items</div>
            <div className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    {item.variantName && <p className="text-sm text-muted-foreground">{item.variantName}</p>}
                    {item.productType === "PER_AREA" && item.width && item.height && (
                      <p className="text-sm text-muted-foreground">
                        Dimensions: {item.width} x {item.height} {item.unit}
                      </p>
                    )}
                    <p className="text-sm">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPaiseToRupees(item.totalPricePaise)}</p>
                    <p className="text-sm text-muted-foreground">{formatPaiseToRupees(item.unitPricePaise)} each</p>
                    {order.fulfillmentStatus === "DELIVERED" && item.productId && (
                      <div className="mt-2">
                        <ReviewButton productId={item.productId} productName={item.productName} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border p-4 space-y-4">
            <h2 className="font-medium">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPaiseToRupees(order.subtotalPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>-{formatPaiseToRupees(order.discountPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatPaiseToRupees(order.shippingPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPaiseToRupees(order.taxPaise)}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t">
                <span>Total</span>
                <span>{formatPaiseToRupees(order.totalPaise)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <h2 className="font-medium">Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment</span>
                <span className="capitalize">{order.paymentStatus.toLowerCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fulfillment</span>
                <span className="capitalize">{order.fulfillmentStatus.replace(/_/g, ' ').toLowerCase()}</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAdminOrderDetail } from "@/lib/order/admin-order-detail-service";
import { formatPaiseToRupees } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, ChevronLeft } from "lucide-react";
import { FulfillmentActions } from "./fulfillment-actions";
import { RefundActions } from "./refund-actions";
import { ReturnActions } from "./return-actions";

export const metadata = {
  title: "Order Detail | Admin",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let order;
  try {
    order = await getAdminOrderDetail(params.id);
  } catch (error: any) {
    if (error.name === "AuthError" || error.name === "ForbiddenError") {
      redirect("/admin/login");
    }
    throw error;
  }

  if (!order) {
    notFound();
  }

  const shippingAddress = order.shippingAddress as any;
  const billingAddress = order.billingAddress as any;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Link href="/admin/orders">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Order {order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(order.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="border rounded-lg bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Items</h2>
            <div className="space-y-6">
              {order.items.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-4">
                  {/* Media placeholder */}
                  <div className="w-16 h-16 bg-muted rounded-md flex-shrink-0">
                    {/* Assuming OptimizedImage or standard image could go here, omitting for simplicity since mediaKey handling varies */}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="font-medium">{item.productName}</h3>
                    {item.variantName && (
                      <p className="text-sm text-muted-foreground">
                        Variant: {item.variantName}
                      </p>
                    )}
                    {item.productType === "PER_AREA" && item.width && item.height && (
                      <p className="text-sm text-muted-foreground">
                        Dimensions: {item.width} x {item.height} {item.unit}
                        <br />
                        Area: {item.billableAreaSqft} sqft (Rate: {formatPaiseToRupees(item.ratePaise || 0)}/sqft)
                      </p>
                    )}
                    {item.options && (
                      <p className="text-sm text-muted-foreground">
                        Options: {JSON.stringify(item.options)}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      HSN: {item.hsnCode || "N/A"} | Tax: {item.gstRatePct}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatPaiseToRupees(item.unitPricePaise)} × {item.quantity}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {formatPaiseToRupees(item.netTotalPaise)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPaiseToRupees(order.subtotalPaise)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-destructive">
                  -{formatPaiseToRupees(order.discountPaise)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatPaiseToRupees(order.shippingPaise)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPaiseToRupees(order.taxPaise)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPaiseToRupees(order.totalPaise)}</span>
              </div>

              {order.refunds && order.refunds.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-2">Refunds</h4>
                  <div className="space-y-2">
                    {order.refunds.map((refund: any) => (
                      <div key={refund.id} className="flex justify-between text-sm items-center">
                        <div>
                          <Badge variant={refund.status === "PROCESSED" ? "default" : "secondary"} className="mr-2 text-[10px] uppercase">
                            {refund.status}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {new Date(refund.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-destructive font-medium">-₹{(refund.amountPaise / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment & Invoice */}
          <div className="border rounded-lg bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Payment & Invoice</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Payment Details
                </h3>
                <p className="text-sm font-medium">{order.paymentMethod}</p>
                <div className="mt-1">
                  <Badge variant={order.paymentStatus === "PAID" ? "default" : "secondary"}>
                    {order.paymentStatus}
                  </Badge>
                </div>
                {order.razorpayOrderId && (
                  <p className="text-xs text-muted-foreground mt-2 break-all">
                    Ref: {order.razorpayOrderId}
                  </p>
                )}
                {order.razorpayPaymentId && (
                  <p className="text-xs text-muted-foreground break-all">
                    Txn: {order.razorpayPaymentId}
                  </p>
                )}
                
                <RefundActions
                  orderId={order.id}
                  paymentMethod={order.paymentMethod}
                  paymentStatus={order.paymentStatus}
                  totalAmountPaise={order.totalPaise}
                  alreadyRefundedPaise={(order.refunds || [])
                    .filter((r: any) => r.status !== "FAILED")
                    .reduce((sum: number, r: any) => sum + r.amountPaise, 0)}
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Invoice
                </h3>
                {order.invoiceNumber ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{order.invoiceNumber}</p>
                    {order.invoiceR2Key ? (
                      <a
                        href={`/api/admin/orders/${order.id}/invoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <FileText className="mr-2 h-4 w-4" />
                          View Invoice
                        </Button>
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        PDF not available in storage.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not generated</p>
                )}
              </div>
            </div>
          </div>
          
          <ReturnActions order={order} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="border rounded-lg bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Customer</h2>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-muted-foreground">{order.customerEmail}</p>
              {order.customerPhone && (
                <p className="text-muted-foreground">{order.customerPhone}</p>
              )}
            </div>
          </div>

          {/* Fulfillment Status */}
          <div className="border rounded-lg bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Fulfillment</h2>
            <FulfillmentActions
              orderId={order.id}
              currentStatus={order.fulfillmentStatus}
            />
            {order.courierName && (
              <p className="text-sm mt-4 text-muted-foreground">
                Courier: {order.courierName}
              </p>
            )}
            {order.awb && (
              <p className="text-sm text-muted-foreground">AWB: {order.awb}</p>
            )}
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Track Shipment
              </a>
            )}
          </div>

          {/* Addresses */}
          <div className="border rounded-lg bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Addresses</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Shipping Address
                </h3>
                {shippingAddress ? (
                  <address className="not-italic text-sm text-foreground">
                    {shippingAddress.firstName} {shippingAddress.lastName}
                    <br />
                    {shippingAddress.addressLine1}
                    <br />
                    {shippingAddress.addressLine2 && (
                      <>
                        {shippingAddress.addressLine2}
                        <br />
                      </>
                    )}
                    {shippingAddress.city}, {shippingAddress.state}{" "}
                    {shippingAddress.pincode}
                  </address>
                ) : (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Billing Address
                </h3>
                {billingAddress ? (
                  <address className="not-italic text-sm text-foreground">
                    {billingAddress.firstName} {billingAddress.lastName}
                    <br />
                    {billingAddress.addressLine1}
                    <br />
                    {billingAddress.addressLine2 && (
                      <>
                        {billingAddress.addressLine2}
                        <br />
                      </>
                    )}
                    {billingAddress.city}, {billingAddress.state}{" "}
                    {billingAddress.pincode}
                  </address>
                ) : (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

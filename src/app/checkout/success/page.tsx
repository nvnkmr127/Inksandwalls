import { Metadata } from "next";
import Link from "next/link";
import { getOrderByNumber } from "@/lib/order/order-service";
import { formatPaiseToRupees } from "@/lib/money";
import {
  CheckCircle2,
  Package,
  CreditCard,
  Banknote,
  FileText,
  ArrowRight,
  ShieldCheck,
  Truck,
  MapPin,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Order Confirmation - INKs & Walls",
};

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNumber?: string; orderId?: string }>;
}) {
  const resolvedParams = await searchParams;
  const orderNumber = resolvedParams.orderNumber;

  if (!orderNumber) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <h1 className="text-2xl font-bold text-neutral-900 mb-3">Order Not Found</h1>
        <p className="text-sm text-neutral-600 mb-6">
          No order number was provided in the request.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
        >
          Return to Store
        </Link>
      </div>
    );
  }

  let order;
  let errorMessage: string | null = null;
  try {
    order = await getOrderByNumber(orderNumber);
  } catch (error) {
    errorMessage = (error as Error).message;
  }

  if (!order || errorMessage) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <h1 className="text-2xl font-bold text-neutral-900 mb-3">Order Unavailable</h1>
        <p className="text-sm text-rose-600 mb-6">
          {errorMessage || "We could not find the specified order."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
        >
          Return to Store
        </Link>
      </div>
    );
  }

  const isOnlinePayment = order.paymentMethod === "RAZORPAY";
  const isPaid = order.paymentStatus === "PAID";

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Top Success Banner */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-3xl p-6 sm:p-8 text-center mb-8">
        <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-emerald-950 mb-2">
          Thank you! Your order is confirmed.
        </h1>
        <p className="text-sm text-emerald-800 max-w-md mx-auto">
          We have received your order and sent a confirmation summary to{" "}
          <strong className="text-emerald-950">{order.customerEmail}</strong>.
        </p>

        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 bg-white/90 border border-emerald-200 px-5 py-2.5 rounded-2xl text-xs font-semibold text-neutral-800 shadow-2xs">
          <span>Order Number:</span>
          <span className="font-mono text-sm font-bold text-neutral-950">
            {order.orderNumber}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Order Items & Delivery */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Card */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-neutral-700" />
              <h2 className="text-base font-bold text-neutral-900">
                Order Items ({order.items.length})
              </h2>
            </div>

            <div className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      {item.productName}
                    </h3>
                    {item.productType === "PER_AREA" && item.width && item.height && (
                      <p className="text-xs text-neutral-600">
                        Dimensions: {item.width} × {item.height} {item.unit || "ft"} (
                        {item.billableAreaSqft || item.enteredAreaSqft} sq.ft)
                      </p>
                    )}
                    {item.variantName && (
                      <p className="text-xs text-neutral-600">
                        Variant: {item.variantName}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500">
                      Qty: {item.quantity} · Rate: {formatPaiseToRupees(item.unitPricePaise)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-neutral-900">
                      {formatPaiseToRupees(item.totalPricePaise)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery & Address Card */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-neutral-700" />
              <h2 className="text-base font-bold text-neutral-900">
                Delivery Address
              </h2>
            </div>
            <div className="text-xs text-neutral-700 leading-relaxed pl-7">
              <p className="font-semibold text-neutral-900 text-sm mb-1">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p>{order.shippingAddress.addressLine1}</p>
              {order.shippingAddress.addressLine2 && (
                <p>{order.shippingAddress.addressLine2}</p>
              )}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
                {order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.country}</p>
              {order.shippingAddress.phone && (
                <p className="mt-1 text-neutral-500">
                  Phone: {order.shippingAddress.phone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Payment & Totals */}
        <div className="space-y-6">
          {/* Payment Status Card */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              {isOnlinePayment ? (
                <CreditCard className="w-5 h-5 text-neutral-700" />
              ) : (
                <Banknote className="w-5 h-5 text-neutral-700" />
              )}
              <h2 className="text-base font-bold text-neutral-900">
                Payment Details
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Method:</span>
                <span className="font-semibold text-neutral-900">
                  {isOnlinePayment ? "Online Payment (Razorpay)" : "Cash on Delivery (COD)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Payment Status:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded-md ${
                    isPaid
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isPaid ? "PAID" : "PAY ON DELIVERY (UNPAID)"}
                </span>
              </div>
              {order.razorpayPaymentId && (
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>Payment Ref:</span>
                  <span className="font-mono">{order.razorpayPaymentId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pricing Totals Card */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-2xs">
            <h2 className="text-base font-bold text-neutral-900 mb-4">
              Order Summary
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>{formatPaiseToRupees(order.subtotalPaise)}</span>
              </div>

              {order.discountPaise > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
                  <span>-{formatPaiseToRupees(order.discountPaise)}</span>
                </div>
              )}

              <div className="flex justify-between text-neutral-600">
                <span>Shipping</span>
                <span>
                  {order.shippingPaise === 0
                    ? "FREE"
                    : formatPaiseToRupees(order.shippingPaise)}
                </span>
              </div>

              <div className="flex justify-between text-neutral-600">
                <span>GST Tax</span>
                <span>{formatPaiseToRupees(order.taxPaise)}</span>
              </div>

              <div className="border-t border-neutral-200 pt-3 mt-3 flex justify-between text-sm font-bold text-neutral-900">
                <span>Total Amount</span>
                <span>{formatPaiseToRupees(order.totalPaise)}</span>
              </div>
            </div>

            {/* GST Invoice Download Link */}
            {order.invoiceNumber && (
              <div className="mt-6 pt-4 border-t border-neutral-100">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-neutral-800 font-medium">
                    <FileText className="w-4 h-4 text-neutral-600" />
                    <span>GST Invoice: {order.invoiceNumber}</span>
                  </div>
                  {order.invoiceUrl && (
                    <a
                      href={order.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-neutral-900 underline hover:text-neutral-700"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/"
            className="w-full py-3 px-6 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

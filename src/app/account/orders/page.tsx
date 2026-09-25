import { Metadata } from "next";
import Link from "next/link";
import { getCustomerOrders } from "@/lib/order/order-list-service";
import { formatPaiseToRupees } from "@/lib/money";

export const metadata: Metadata = {
  title: "Order History | INKs & Walls",
  description: "View your past orders",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = parseInt(searchParams.page || "1", 10);
  const { orders, totalPages } = await getCustomerOrders({ page, pageSize: 10 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Order History</h1>
      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h2 className="text-lg font-medium">No orders yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You haven't placed any orders. Start exploring our collections.
          </p>
          <Link href="/products" className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border p-4 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <p className="font-medium text-sm text-muted-foreground mb-1">
                  Order #{order.orderNumber}
                </p>
                <p className="text-sm font-medium">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>Total: {formatPaiseToRupees(order.totalPaise)}</p>
                  <p>Status: {order.fulfillmentStatus}</p>
                  <p>Items: {order.items?.length || 0}</p>
                </div>
              </div>
              <Link
                href={`/account/orders/${order.orderNumber}`}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                View Details
              </Link>
            </div>
          ))}
          
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: totalPages }).map((_, i) => (
                <Link
                  key={i}
                  href={`/account/orders?page=${i + 1}`}
                  className={`px-3 py-1 rounded border ${page === i + 1 ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {i + 1}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

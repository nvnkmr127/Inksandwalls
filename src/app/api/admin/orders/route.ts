import { NextRequest, NextResponse } from "next/server";
import { getAdminOrders } from "@/lib/order/order-list-service";
import { PaymentStatus, FulfillmentStatus, PaymentMethod } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || undefined;
    const paymentStatus = searchParams.get("paymentStatus") as PaymentStatus | undefined;
    const fulfillmentStatus = searchParams.get("fulfillmentStatus") as FulfillmentStatus | undefined;
    const paymentMethod = searchParams.get("paymentMethod") as PaymentMethod | undefined;
    
    // Sort handling
    const sortBy = (searchParams.get("sort") || "createdAt") as any;
    const sortDirection = (searchParams.get("order") || "desc") as any;

    const result = await getAdminOrders({
      page,
      pageSize,
      search,
      paymentStatus: (paymentStatus as string) !== "all" ? paymentStatus : undefined,
      fulfillmentStatus: (fulfillmentStatus as string) !== "all" ? fulfillmentStatus : undefined,
      paymentMethod: (paymentMethod as string) !== "all" ? paymentMethod : undefined,
      sortBy,
      sortDirection,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to fetch admin orders", error);
    if (error.name === "ForbiddenError" || error.name === "AuthError") {
      return NextResponse.json({ error: error.message }, { status: error.name === "AuthError" ? 401 : 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

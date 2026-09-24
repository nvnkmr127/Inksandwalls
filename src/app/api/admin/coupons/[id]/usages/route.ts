import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getCouponUsages } from "@/lib/coupons/coupon-service";
import { createErrorResponse } from "@/lib/errors";
import { getCorrelationId } from "@/lib/correlation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 20;

    const result = await getCouponUsages(id, page, pageSize);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCouponUsagesAPI");
  }
}

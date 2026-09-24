import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getCouponById,
  updateCoupon,
  deleteCoupon,
} from "@/lib/coupons/coupon-service";
import { createErrorResponse } from "@/lib/errors";
import { extractRequestContext } from "@/lib/audit/audit";
import { getCorrelationId } from "@/lib/correlation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();
    const { id } = await params;

    const coupon = await getCouponById(id);
    return NextResponse.json(coupon, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCouponItemAPI");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const reqContext = extractRequestContext(request);

    const updated = await updateCoupon(id, body, actor, reqContext);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCouponItemAPI");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const reqContext = extractRequestContext(request);

    const deleted = await deleteCoupon(id, actor, reqContext);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCouponItemAPI");
  }
}

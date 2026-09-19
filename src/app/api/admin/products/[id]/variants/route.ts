import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  createProductVariant,
  listProductVariants,
} from "@/lib/product-variants/variant-service";
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
    const { id: productId } = await params;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 10;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const sort = searchParams.get("sort") || undefined;
    const order = (searchParams.get("order") || undefined) as "asc" | "desc" | undefined;

    const result = await listProductVariants(productId, {
      page,
      pageSize,
      search,
      status,
      sort,
      order,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductVariantAPI");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id: productId } = await params;
    const body = await request.json();
    const reqContext = extractRequestContext(request);

    const variant = await createProductVariant(productId, body, actor, reqContext);

    return NextResponse.json(variant, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductVariantAPI");
  }
}

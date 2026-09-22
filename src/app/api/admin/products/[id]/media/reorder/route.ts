import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { reorderProductMedia } from "@/lib/product-media/media-service";
import { createErrorResponse } from "@/lib/errors";
import { extractRequestContext } from "@/lib/audit/audit";
import { getCorrelationId } from "@/lib/correlation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id: productId } = await params;
    const body = await request.json();
    const reqContext = extractRequestContext(request);

    const updated = await reorderProductMedia(productId, body, actor, reqContext);
    return NextResponse.json({ success: true, items: updated }, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductMediaReorderAPI");
  }
}

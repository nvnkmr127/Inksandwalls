import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { setPrimaryProductMedia } from "@/lib/product-media/media-service";
import { createErrorResponse } from "@/lib/errors";
import { extractRequestContext } from "@/lib/audit/audit";
import { getCorrelationId } from "@/lib/correlation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id: productId, mediaId } = await params;
    const reqContext = extractRequestContext(request);

    const updated = await setPrimaryProductMedia(productId, mediaId, actor, reqContext);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductMediaSetPrimaryAPI");
  }
}

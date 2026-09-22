import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getProductMediaById,
  updateProductMediaMetadata,
  deleteProductMedia,
} from "@/lib/product-media/media-service";
import { createErrorResponse } from "@/lib/errors";
import { extractRequestContext } from "@/lib/audit/audit";
import { getCorrelationId } from "@/lib/correlation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();
    const { id: productId, mediaId } = await params;

    const media = await getProductMediaById(productId, mediaId);
    return NextResponse.json(media, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductMediaItemGetAPI");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id: productId, mediaId } = await params;
    const body = await request.json();
    const reqContext = extractRequestContext(request);

    const updated = await updateProductMediaMetadata(
      productId,
      mediaId,
      body,
      actor,
      reqContext
    );

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductMediaItemUpdateAPI");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id: productId, mediaId } = await params;
    const reqContext = extractRequestContext(request);

    const result = await deleteProductMedia(productId, mediaId, actor, reqContext);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductMediaItemDeleteAPI");
  }
}

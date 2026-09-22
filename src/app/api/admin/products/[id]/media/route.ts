import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  listProductMedia,
  uploadProductMedia,
} from "@/lib/product-media/media-service";
import { createErrorResponse, ValidationError } from "@/lib/errors";
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

    const result = await listProductMedia(productId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductMediaListAPI");
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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new ValidationError("Missing or invalid 'file' field in multipart form submission.");
    }

    const altText = (formData.get("altText") as string) || undefined;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const reqContext = extractRequestContext(request);

    const media = await uploadProductMedia({
      productId,
      buffer,
      mimeType: file.type,
      altText,
      actor,
      reqContext,
    });

    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductMediaUploadAPI");
  }
}

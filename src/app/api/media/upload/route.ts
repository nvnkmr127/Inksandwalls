import { NextResponse } from "next/server";
import { uploadMedia } from "@/lib/media/upload";
import { logger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/correlation";
import { createErrorResponse, AuthError, ValidationError } from "@/lib/errors";

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    logger.info("Media upload API request received", {
      component: "MediaUploadAPI",
      correlationId,
    });

    // Structural authorization check hook for Phase 02 Auth integration
    const isDev = process.env.NODE_ENV === "development";
    const authHeader = request.headers.get("x-upload-auth-secret");
    const cronSecret = process.env.CRON_SECRET;

    if (!isDev && cronSecret && authHeader !== cronSecret) {
      throw new AuthError("Unauthorized upload request.");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new ValidationError("Missing or invalid 'file' field in multipart request body.");
    }

    const resource = (formData.get("resource") as string) || "media";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadMedia({
      buffer,
      mimeType: file.type,
      resource,
    });

    if (!result.success) {
      logger.warn("Media processing failed", {
        component: "MediaUploadAPI",
        correlationId,
        error: result.error,
      });
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: result.error,
            correlationId,
          },
        },
        { status: 400 }
      );
    }

    logger.info("Media uploaded successfully", {
      component: "MediaUploadAPI",
      correlationId,
      mediaId: result.mediaId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return createErrorResponse(error, correlationId, "MediaUploadAPI");
  }
}

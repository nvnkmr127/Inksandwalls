import "server-only";
import { validateImageFile } from "./validation";
import { processImageVariants } from "./pipeline";
import { generateMediaId, generateObjectKey } from "../storage/keys";
import { uploadObject, isR2Configured } from "../storage/storage";

export interface MediaVariantMetadata {
  objectKey: string;
  variant: string;
  width: number;
  height: number;
  format: string;
  size: number;
  url: string;
}

export interface UploadMediaResult {
  success: true;
  mediaId: string;
  sourceMetadata: {
    width: number;
    height: number;
    format: string;
  };
  variants: MediaVariantMetadata[];
}

export interface UploadMediaError {
  success: false;
  error: string;
}

export interface UploadMediaOptions {
  buffer: Buffer;
  mimeType: string;
  resource?: string;
  maxSizeBytes?: number;
}

/**
  Server-side media upload orchestrator.
  1. Validates file size, MIME type, and magic bytes.
  2. Processes Sharp image variants (auto-rotation, responsive WebP conversion).
  3. Uploads generated variants to Cloudflare R2 (or returns variant descriptors if R2 mock/dev mode).
  4. Returns structured metadata.
 */
export async function uploadMedia({
  buffer,
  mimeType,
  resource = "media",
  maxSizeBytes,
}: UploadMediaOptions): Promise<UploadMediaResult | UploadMediaError> {
  try {
    // 1. Validate file payload
    const validation = validateImageFile(buffer, mimeType, maxSizeBytes);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || "File validation failed.",
      };
    }

    // 2. Process image variants with Sharp
    const pipelineResult = await processImageVariants(buffer);
    const mediaId = generateMediaId();

    // 3. Upload variants to Cloudflare R2
    const uploadedVariants: MediaVariantMetadata[] = [];

    for (const variant of pipelineResult.variants) {
      const objectKey = generateObjectKey({
        resource,
        uniqueId: mediaId,
        variant: variant.name,
        format: variant.format,
      });

      if (isR2Configured()) {
        const uploadRes = await uploadObject({
          key: objectKey,
          body: variant.buffer,
          contentType: `image/${variant.format}`,
        });

        uploadedVariants.push({
          objectKey: uploadRes.key,
          variant: variant.name,
          width: variant.width,
          height: variant.height,
          format: variant.format,
          size: uploadRes.size,
          url: uploadRes.url,
        });
      } else {
        // Fallback descriptor for dev environment when R2 credentials are not set
        uploadedVariants.push({
          objectKey,
          variant: variant.name,
          width: variant.width,
          height: variant.height,
          format: variant.format,
          size: variant.size,
          url: `/uploads/mock/${objectKey}`,
        });
      }
    }

    return {
      success: true,
      mediaId,
      sourceMetadata: pipelineResult.sourceMetadata,
      variants: uploadedVariants,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected upload processing error occurred.";
    return {
      success: false,
      error: message,
    };
  }
}

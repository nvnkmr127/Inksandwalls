import "server-only";

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB default

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  detectedFormat?: string;
}

/**
  Inspect magic bytes in binary buffer to verify actual image content.
 */
export function detectImageFormatFromMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }

  // WebP: bytes 0-3 'RIFF', bytes 8-11 'WEBP'
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  if (isRiff && isWebp) {
    return "webp";
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "gif";
  }

  // AVIF / HEIC / ISO BMFF: ftypavif or ftypisom at offset 4
  const ftypSlice = buffer.toString("ascii", 4, 12);
  if (ftypSlice.includes("ftypavif") || ftypSlice.includes("ftypisom")) {
    return "avif";
  }

  return null;
}

/**
  Validates uploaded file size, MIME type, and binary magic bytes header.
 */
export function validateImageFile(
  buffer: Buffer,
  mimeType: string,
  maxSizeBytes: number = MAX_UPLOAD_SIZE_BYTES
): ValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Empty or invalid file payload." };
  }

  if (buffer.length > maxSizeBytes) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size (${sizeMb}MB) exceeds the maximum allowed limit of ${limitMb}MB.`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return {
      valid: false,
      error: `Unsupported image MIME type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}.`,
    };
  }

  const detectedFormat = detectImageFormatFromMagicBytes(buffer);
  if (!detectedFormat) {
    return {
      valid: false,
      error: "File signature validation failed. Payload is not a valid or supported image binary.",
    };
  }

  return {
    valid: true,
    detectedFormat,
  };
}

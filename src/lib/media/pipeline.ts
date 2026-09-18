import "server-only";
import sharp from "sharp";

export interface VariantConfig {
  name: string;
  maxWidth: number;
}

export const VARIANT_BREAKPOINTS: VariantConfig[] = [
  { name: "thumbnail", maxWidth: 200 },
  { name: "small", maxWidth: 600 },
  { name: "medium", maxWidth: 1200 },
  { name: "large", maxWidth: 1920 },
  { name: "original", maxWidth: 2560 },
];

export interface ProcessedVariant {
  name: string;
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ImagePipelineResult {
  sourceMetadata: {
    width: number;
    height: number;
    format: string;
    space?: string;
  };
  variants: ProcessedVariant[];
}

/**
  Processes an input image buffer with Sharp, auto-rotating EXIF orientation,
  and generating optimized WebP responsive variants.
 */
export async function processImageVariants(
  inputBuffer: Buffer,
  outputQuality: number = 82
): Promise<ImagePipelineResult> {
  const sharpInstance = sharp(inputBuffer);
  const metadata = await sharpInstance.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to extract dimensions from image buffer.");
  }

  const sourceWidth = metadata.width;
  const sourceHeight = metadata.height;
  const format = metadata.format || "unknown";

  const processedVariants: ProcessedVariant[] = [];

  for (const variant of VARIANT_BREAKPOINTS) {
    // Only downscale if source is larger than target breakpoint, unless it's the thumbnail/small fallback
    const targetWidth = Math.min(sourceWidth, variant.maxWidth);
    
    // Process image variant
    const variantPipeline = sharp(inputBuffer)
      .rotate() // Auto-rotate using EXIF orientation
      .resize({
        width: targetWidth,
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality: outputQuality, effort: 4 });

    const { data: buffer, info } = await variantPipeline.toBuffer({ resolveWithObject: true });

    processedVariants.push({
      name: variant.name,
      buffer,
      width: info.width,
      height: info.height,
      format: "webp",
      size: buffer.byteLength,
    });
  }

  return {
    sourceMetadata: {
      width: sourceWidth,
      height: sourceHeight,
      format,
      space: metadata.space,
    },
    variants: processedVariants,
  };
}

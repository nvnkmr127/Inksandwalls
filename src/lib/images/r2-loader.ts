export interface R2ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export function getVariantNameForWidth(width: number): string {
  if (width <= 200) return "thumbnail";
  if (width <= 600) return "small";
  if (width <= 1200) return "medium";
  if (width <= 1920) return "large";
  return "original";
}

/**
  Custom R2 image loader for Next.js <Image /> component.
  Resolves stored responsive WebP variant URLs directly from Cloudflare R2 bucket / domain.
 */
export default function r2Loader({ src, width }: R2ImageLoaderProps): string {
  const publicDomain = (process.env.NEXT_PUBLIC_R2_DOMAIN || process.env.R2_PUBLIC_DOMAIN || process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

  // If src is already a full external URL
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  const targetVariant = getVariantNameForWidth(width);

  // If key follows pattern uploads/{resource}/{id}/{variant}.{format}
  let resolvedKey = src.startsWith("/") ? src.slice(1) : src;

  // Replace variant token in key if present (e.g. .../thumbnail.webp -> .../medium.webp)
  resolvedKey = resolvedKey.replace(
    /\/(thumbnail|small|medium|large|original)\.(webp|png|jpg|jpeg|avif)$/i,
    `/${targetVariant}.$2`
  );

  if (publicDomain) {
    return `${publicDomain}/${resolvedKey}`;
  }

  return `/${resolvedKey}`;
}

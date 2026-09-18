import "server-only";
import crypto from "node:crypto";

export interface ObjectKeyParams {
  resource?: string;
  uniqueId?: string;
  variant: string;
  format: string;
}

/**
  Sanitize path segment to remove path traversal and unsafe characters.
 */
export function sanitizeKeySegment(input: string): string {
  if (!input) return "default";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
  Generates deterministic, safe R2 object keys.
  Format: uploads/{resource}/{uniqueId}/{variant}.{format}
 */
export function generateObjectKey({
  resource = "media",
  uniqueId,
  variant,
  format,
}: ObjectKeyParams): string {
  const safeResource = sanitizeKeySegment(resource) || "media";
  const safeId = uniqueId ? sanitizeKeySegment(uniqueId) : crypto.randomBytes(8).toString("hex");
  const safeVariant = sanitizeKeySegment(variant) || "default";
  const safeFormat = sanitizeKeySegment(format) || "webp";

  return `uploads/${safeResource}/${safeId}/${safeVariant}.${safeFormat}`;
}

/**
  Generate unique identifier for an upload batch / image record.
 */
export function generateMediaId(): string {
  return crypto.randomBytes(12).toString("hex");
}

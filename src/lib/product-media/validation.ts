import { ValidationError } from "@/lib/errors";

const ALLOWED_METADATA_FIELDS = new Set(["altText"]);
const ALLOWED_REORDER_FIELDS = new Set(["mediaIds"]);

export interface ValidatedMediaMetadataUpdate {
  altText: string | null;
}

export interface ValidatedMediaReorderInput {
  mediaIds: string[];
}

/**
 * Validates alt text string bounds and content.
 */
export function sanitizeAltText(rawAlt?: unknown): string | null {
  if (rawAlt === null || rawAlt === undefined) {
    return null;
  }

  if (typeof rawAlt !== "string") {
    throw new ValidationError("Alt text must be a string.");
  }

  const trimmed = rawAlt.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 500) {
    throw new ValidationError("Alt text cannot exceed 500 characters.");
  }

  // Reject ASCII control characters except standard whitespace
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    throw new ValidationError("Alt text contains invalid control characters.");
  }

  return trimmed;
}

/**
 * Validates metadata update payload (e.g. PATCH /media/:mediaId).
 */
export function validateMediaMetadataUpdate(input: unknown): ValidatedMediaMetadataUpdate {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Invalid request body. Expected a JSON object.");
  }

  const record = input as Record<string, unknown>;

  // Reject unexpected fields to protect against mass assignment
  for (const key of Object.keys(record)) {
    if (!ALLOWED_METADATA_FIELDS.has(key)) {
      throw new ValidationError(`Unexpected field: '${key}'. Only 'altText' may be modified.`);
    }
  }

  const altText = sanitizeAltText(record.altText);

  return { altText };
}

/**
 * Validates reorder media payload (e.g. PATCH /media/reorder).
 */
export function validateMediaReorderInput(input: unknown): ValidatedMediaReorderInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Invalid request body. Expected a JSON object.");
  }

  const record = input as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!ALLOWED_REORDER_FIELDS.has(key)) {
      throw new ValidationError(`Unexpected field: '${key}'. Only 'mediaIds' is allowed.`);
    }
  }

  if (!Array.isArray(record.mediaIds)) {
    throw new ValidationError("'mediaIds' must be an array of media IDs.");
  }

  if (record.mediaIds.length === 0) {
    throw new ValidationError("'mediaIds' array cannot be empty.");
  }

  if (record.mediaIds.length > 100) {
    throw new ValidationError("'mediaIds' array exceeds maximum limit of 100 items.");
  }

  const seen = new Set<string>();
  const sanitizedIds: string[] = [];

  for (let i = 0; i < record.mediaIds.length; i++) {
    const item = record.mediaIds[i];
    if (typeof item !== "string" || !item.trim()) {
      throw new ValidationError(`Media ID at index ${i} must be a non-empty string.`);
    }

    const trimmed = item.trim();
    if (seen.has(trimmed)) {
      throw new ValidationError(`Duplicate media ID detected in reorder array: '${trimmed}'.`);
    }

    seen.add(trimmed);
    sanitizedIds.push(trimmed);
  }

  return { mediaIds: sanitizedIds };
}

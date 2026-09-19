/**
 * Category Slug Utility Functions
 */

/**
 * Generate a clean, lowercase, URL-safe slug from a string name.
 */
export function generateSlug(name: string): string {
  if (!name) return "";

  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, "-") // replace spaces and underscores with single hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/**
 * Normalize a given custom slug string to ensure URL safety and consistency.
 */
export function normalizeSlug(slug: string): string {
  return generateSlug(slug);
}

/**
 * Validate that a slug is valid format (lowercase alphanumeric and hyphens, 1-100 chars).
 */
export function validateSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  const normalized = normalizeSlug(slug);
  return normalized.length >= 1 && normalized.length <= 100 && normalized === slug.toLowerCase().trim();
}

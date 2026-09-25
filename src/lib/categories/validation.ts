import { ValidationError } from "@/lib/errors";
import { normalizeSlug } from "./slug";

export interface CategorySeoInput {
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  h1?: string | null;
  introContent?: string | null;
}


export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  seo?: CategorySeoInput | null;
}

export interface ValidatedCategoryData {
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  seo?: CategorySeoInput | null;
}

/**
 * Validates and normalizes category mutation payload server-side.
 */
export function validateCategoryInput(input: unknown): ValidatedCategoryData {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Invalid request body. Expected an object.");
  }

  const data = input as Record<string, unknown>;

  // 1. Validate Name
  if (typeof data.name !== "string") {
    throw new ValidationError("Category name is required.");
  }

  const name = data.name.trim();

  if (name.length === 0) {
    throw new ValidationError("Category name cannot be empty.");
  }

  if (name.length > 100) {
    throw new ValidationError("Category name cannot exceed 100 characters.");
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(name)) {
    throw new ValidationError("Category name contains invalid characters.");
  }

  // 2. Validate & Normalize Slug
  let rawSlug = typeof data.slug === "string" ? data.slug.trim() : "";
  if (!rawSlug) {
    rawSlug = name;
  }

  const slug = normalizeSlug(rawSlug);

  if (!slug || slug.length === 0) {
    throw new ValidationError("A valid URL-safe category slug could not be generated.");
  }

  if (slug.length > 100) {
    throw new ValidationError("Category slug cannot exceed 100 characters.");
  }

  // 3. Validate Description
  let description: string | null = null;
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== "string") {
      throw new ValidationError("Category description must be a string.");
    }
    const trimmedDesc = data.description.trim();
    if (trimmedDesc.length > 1000) {
      throw new ValidationError("Category description cannot exceed 1000 characters.");
    }
    description = trimmedDesc.length > 0 ? trimmedDesc : null;
  }

  // 4. Validate isActive
  let isActive = true;
  if (data.isActive !== undefined) {
    if (typeof data.isActive !== "boolean") {
      throw new ValidationError("isActive must be a boolean value.");
    }
    isActive = data.isActive;
  }

  // 5. Validate sortOrder
  let sortOrder = 0;
  if (data.sortOrder !== undefined && data.sortOrder !== null) {
    if (typeof data.sortOrder !== "number" || !Number.isInteger(data.sortOrder)) {
      throw new ValidationError("Sort order must be an integer.");
    }
    if (data.sortOrder < -999999 || data.sortOrder > 999999) {
      throw new ValidationError("Sort order must be between -999999 and 999999.");
    }
    sortOrder = data.sortOrder;
  }

  // 6. SEO validation
  let seo: CategorySeoInput | null = null;
  if (data.seo && typeof data.seo === "object") {
    const rawSeo = data.seo as Record<string, unknown>;
    seo = {};
    const stringFields = [
      "title", "description", "canonicalUrl", "h1", "introContent"
    ];
    for (const field of stringFields) {
      if (typeof rawSeo[field] === "string" && (rawSeo[field] as string).trim()) {
        seo[field as keyof CategorySeoInput] = (rawSeo[field] as string).trim();
      } else {
        seo[field as keyof CategorySeoInput] = null;
      }
    }
    if (seo.canonicalUrl && !seo.canonicalUrl.startsWith("http") && !seo.canonicalUrl.startsWith("/")) {
      throw new ValidationError("Canonical URL must be a valid absolute or relative URL.");
    }
  }

  return {
    name,
    slug,
    description,
    isActive,
    sortOrder,
    seo,
  };
}

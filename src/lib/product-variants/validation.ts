import { ValidationError } from "@/lib/errors";

export interface CreateProductVariantInput {
  name: string;
  sku?: string | null;
  price: number; // in minor units (paise)
  isActive?: boolean;
  sortOrder?: number;
}

export interface ValidatedProductVariantInput {
  name: string;
  sku: string | null;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Validate and sanitize ProductVariant input data.
 */
export function validateProductVariantInput(input: unknown): ValidatedProductVariantInput {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Invalid variant input: expected an object.");
  }

  const raw = input as Record<string, unknown>;

  // Reject unexpected fields
  const allowedKeys = new Set(["name", "sku", "price", "isActive", "sortOrder"]);
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) {
      throw new ValidationError(`Unexpected field: '${key}'.`);
    }
  }

  // 1. Name validation
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    throw new ValidationError("Variant name is required.");
  }

  const name = raw.name.trim();
  if (name.length > 200) {
    throw new ValidationError("Variant name cannot exceed 200 characters.");
  }

  if (/[\x00-\x1F\x7F]/.test(name)) {
    throw new ValidationError("Variant name contains invalid control characters.");
  }

  // 2. SKU validation (Optional)
  let sku: string | null = null;
  if (typeof raw.sku === "string" && raw.sku.trim()) {
    sku = raw.sku.trim();
    if (sku.length > 50) {
      throw new ValidationError("SKU cannot exceed 50 characters.");
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(sku)) {
      throw new ValidationError(
        "SKU contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed."
      );
    }
  }

  // 3. Price validation (Required integer minor units > 0)
  if (
    raw.price === undefined ||
    raw.price === null ||
    typeof raw.price !== "number" ||
    isNaN(raw.price)
  ) {
    throw new ValidationError("Variant price is required.");
  }

  const price = Math.round(raw.price);
  if (price <= 0) {
    throw new ValidationError("Variant price must be greater than zero.");
  }

  // 4. Status & Sort Order flags
  const isActive = raw.isActive !== undefined ? Boolean(raw.isActive) : true;
  
  let sortOrder = 0;
  if (raw.sortOrder !== undefined && raw.sortOrder !== null && raw.sortOrder !== "") {
    const parsedSort = Number(raw.sortOrder);
    if (isNaN(parsedSort) || !Number.isInteger(parsedSort)) {
      throw new ValidationError("Sort order must be an integer.");
    }
    sortOrder = parsedSort;
  }

  return {
    name,
    sku,
    price,
    isActive,
    sortOrder,
  };
}

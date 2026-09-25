import { ProductType } from "@prisma/client";
import { ValidationError } from "@/lib/errors";
import { generateSlug, validateSlug } from "./slug";

export interface ProductSeoInput {
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  metaRobots?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  h1?: string | null;
}

export interface CreateProductInput {
  name: string;
  slug?: string;
  description?: string | null;
  productType: ProductType;
  isActive?: boolean;
  price?: number | null; // in paise
  rate?: number | null; // in paise (per sqft)
  wastage?: number | null; // percentage e.g. 10.0 for 10%
  minArea?: number | null; // sqft
  rollWidth?: number | null; // width unit
  returnable?: boolean;
  hsnCode?: string | null;
  categoryId: string;
  seo?: ProductSeoInput | null;
}

export interface ValidatedProductInput {
  name: string;
  slug: string;
  description: string | null;
  productType: ProductType;
  isActive: boolean;
  price: number | null;
  rate: number | null;
  wastage: number | null;
  minArea: number | null;
  rollWidth: number | null;
  returnable: boolean;
  hsnCode: string | null;
  categoryId: string;
  seo?: ProductSeoInput | null;
}

/**
 * Validate and sanitize product input data according to productType business rules.
 */
export function validateProductInput(input: unknown): ValidatedProductInput {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Invalid product input: expected an object.");
  }

  const raw = input as Record<string, unknown>;

  // 1. Name validation
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    throw new ValidationError("Product name is required.");
  }

  const name = raw.name.trim();
  if (name.length > 200) {
    throw new ValidationError("Product name cannot exceed 200 characters.");
  }

  // Prevent control characters in name
  if (/[\x00-\x1F\x7F]/.test(name)) {
    throw new ValidationError("Product name contains invalid control characters.");
  }

  // 2. Product Type validation
  if (
    typeof raw.productType !== "string" ||
    !Object.values(ProductType).includes(raw.productType as ProductType)
  ) {
    throw new ValidationError("Invalid product type. Must be 'PER_AREA' or 'FIXED'.");
  }
  const productType = raw.productType as ProductType;

  // 3. Slug validation
  let slug: string;
  if (typeof raw.slug === "string" && raw.slug.trim()) {
    slug = raw.slug.trim().toLowerCase();
    if (!validateSlug(slug)) {
      throw new ValidationError(
        "Invalid product slug format. Slug must be URL-safe (lowercase letters, numbers, and hyphens)."
      );
    }
  } else {
    slug = generateSlug(name);
    if (!slug) {
      throw new ValidationError("Unable to generate a valid slug from the product name.");
    }
  }

  // 4. Description validation
  let description: string | null = null;
  if (typeof raw.description === "string" && raw.description.trim()) {
    description = raw.description.trim();
    if (description.length > 2000) {
      throw new ValidationError("Product description cannot exceed 2000 characters.");
    }
  }

  // 5. Category validation
  if (typeof raw.categoryId !== "string" || !raw.categoryId.trim()) {
    throw new ValidationError("Category is required.");
  }
  const categoryId = raw.categoryId.trim();

  // 6. Active & Returnable flags
  const isActive = raw.isActive !== undefined ? Boolean(raw.isActive) : true;
  const returnable = raw.returnable !== undefined ? Boolean(raw.returnable) : true;

  // 7. HSN Code validation
  let hsnCode: string | null = null;
  if (typeof raw.hsnCode === "string" && raw.hsnCode.trim()) {
    hsnCode = raw.hsnCode.trim();
    if (hsnCode.length > 20) {
      throw new ValidationError("HSN code cannot exceed 20 characters.");
    }
    if (!/^[a-zA-Z0-9.\-\s]+$/.test(hsnCode)) {
      throw new ValidationError("HSN code contains invalid characters.");
    }
  }

  // 8. Conditional Pricing Fields Validation based on ProductType
  let price: number | null = null;
  let rate: number | null = null;
  let wastage: number | null = null;
  let minArea: number | null = null;
  let rollWidth: number | null = null;

  if (productType === ProductType.FIXED) {
    if (
      raw.price === undefined ||
      raw.price === null ||
      typeof raw.price !== "number" ||
      isNaN(raw.price)
    ) {
      throw new ValidationError("Fixed price is required for FIXED products.");
    }

    price = Math.round(raw.price);
    if (price <= 0) {
      throw new ValidationError("Fixed price must be greater than zero.");
    }
    // Fixed products do not use area-specific pricing fields
    rate = null;
    wastage = null;
    minArea = null;
    rollWidth = null;
  } else if (productType === ProductType.PER_AREA) {
    if (
      raw.rate === undefined ||
      raw.rate === null ||
      typeof raw.rate !== "number" ||
      isNaN(raw.rate)
    ) {
      throw new ValidationError("Rate per sqft is required for PER_AREA products.");
    }

    rate = Math.round(raw.rate);
    if (rate <= 0) {
      throw new ValidationError("Rate per sqft must be greater than zero.");
    }

    price = null;

    // Wastage (percentage)
    if (raw.wastage !== undefined && raw.wastage !== null && raw.wastage !== "") {
      const parsedWastage = Number(raw.wastage);
      if (isNaN(parsedWastage) || parsedWastage < 0) {
        throw new ValidationError("Wastage percentage cannot be negative.");
      }
      if (parsedWastage > 100) {
        throw new ValidationError("Wastage percentage cannot exceed 100%.");
      }
      wastage = parsedWastage;
    } else {
      wastage = 0;
    }

    // Minimum Area (sqft)
    if (raw.minArea !== undefined && raw.minArea !== null && raw.minArea !== "") {
      const parsedMinArea = Number(raw.minArea);
      if (isNaN(parsedMinArea) || parsedMinArea < 0) {
        throw new ValidationError("Minimum area cannot be negative.");
      }
      minArea = parsedMinArea;
    } else {
      minArea = null;
    }

    // Roll Width
    if (raw.rollWidth !== undefined && raw.rollWidth !== null && raw.rollWidth !== "") {
      const parsedRollWidth = Number(raw.rollWidth);
      if (isNaN(parsedRollWidth) || parsedRollWidth <= 0) {
        throw new ValidationError("Roll width must be greater than zero.");
      }
      rollWidth = parsedRollWidth;
    } else {
      rollWidth = null;
    }
  }

  // 9. SEO fields validation
  let seo: ProductSeoInput | null = null;
  if (raw.seo && typeof raw.seo === "object") {
    const rawSeo = raw.seo as Record<string, unknown>;
    seo = {};
    const stringFields = [
      "title", "description", "canonicalUrl", "metaRobots",
      "ogTitle", "ogDescription", "ogImage",
      "twitterTitle", "twitterDescription", "twitterImage", "h1"
    ];
    for (const field of stringFields) {
      if (typeof rawSeo[field] === "string" && (rawSeo[field] as string).trim()) {
        seo[field as keyof ProductSeoInput] = (rawSeo[field] as string).trim();
      } else {
        seo[field as keyof ProductSeoInput] = null;
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
    productType,
    isActive,
    price,
    rate,
    wastage,
    minArea,
    rollWidth,
    returnable,
    hsnCode,
    categoryId,
    seo,
  };
}

import "server-only";
import { ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit/audit";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { ValidationError } from "@/lib/errors";
import { parseCsv } from "./csv-parser";
import { generateSlug, validateSlug } from "./slug";
import type { CurrentUser } from "@/lib/auth/session";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const MAX_IMPORT_ROWS = 1000;
export const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export interface ValidatedRowPayload {
  rowNumber: number;
  name: string;
  slug: string;
  sku: string;
  productType: ProductType;
  categoryId: string;
  categoryName: string;
  collectionSlug?: string | null;
  pricePaise: number | null; // in paise
  ratePaise: number | null; // in paise
  wastage: number | null;
  minArea: number | null;
  rollWidth: number | null;
  returnable: boolean;
  isActive: boolean;
  hsnCode: string | null;
  description: string | null;
}

export interface CsvValidationRowResult {
  rowNumber: number;
  sku: string;
  name: string;
  slug: string;
  productType: string;
  category: string;
  collection: string;
  priceRupees: number | null;
  rateRupees: number | null;
  status: "valid" | "invalid";
  errors: string[];
  payload?: ValidatedRowPayload;
}

export interface CsvValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newProducts: number;
  existingSkuConflicts: number;
  categoriesReferenced: string[];
  collectionsReferenced: string[];
  rows: CsvValidationRowResult[];
  canImport: boolean;
}

export interface CsvImportExecutionResult {
  totalRows: number;
  importedCount: number;
  failedCount: number;
  createdProducts: Array<{ id: string; sku: string; name: string; slug: string }>;
  importId: string;
}

/**
 * Normalizes header keys to canonical model names.
 */
function normalizeHeader(raw: string): string {
  const clean = raw.toLowerCase().replace(/[\s_-]+/g, "");
  switch (clean) {
    case "name":
    case "productname":
    case "title":
      return "name";
    case "slug":
    case "productslug":
      return "slug";
    case "sku":
    case "productsku":
      return "sku";
    case "producttype":
    case "type":
      return "productType";
    case "category":
    case "categoryid":
    case "categoryslug":
      return "category";
    case "collection":
    case "collectionid":
    case "collectionslug":
      return "collection";
    case "price":
    case "fixedprice":
    case "baseprice":
    case "unitprice":
      return "price";
    case "rate":
    case "ratepersqft":
    case "ratesqft":
      return "rate";
    case "wastage":
    case "wastagepct":
    case "wastagepercentage":
      return "wastage";
    case "minarea":
    case "minareasqft":
      return "minArea";
    case "rollwidth":
    case "rollwidthft":
      return "rollWidth";
    case "returnable":
    case "isreturnable":
      return "returnable";
    case "hsn":
    case "hsncode":
      return "hsnCode";
    case "isactive":
    case "active":
    case "status":
      return "isActive";
    case "description":
    case "desc":
      return "description";
    default:
      return raw.trim();
  }
}

/**
 * Parses a flexible boolean representation.
 */
function parseBoolean(val: string | undefined, defaultValue: boolean): boolean {
  if (val === undefined || val === null || val === "") return defaultValue;
  const normalized = val.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y" || normalized === "active") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "n" || normalized === "inactive") {
    return false;
  }
  return defaultValue;
}

/**
 * Validates the raw uploaded CSV text and produces a dry-run preview summary.
 */
export async function validateCsvImport(csvContent: string): Promise<CsvValidationSummary> {
  if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
    throw new ValidationError("Uploaded CSV file is empty.");
  }

  if (Buffer.byteLength(csvContent, "utf-8") > MAX_CSV_FILE_SIZE) {
    throw new ValidationError(
      `CSV file exceeds maximum upload size of ${MAX_CSV_FILE_SIZE / (1024 * 1024)} MB.`
    );
  }

  const parsed = parseCsv(csvContent);

  if (parsed.headers.length === 0) {
    throw new ValidationError("CSV header row is missing or malformed.");
  }

  // 1. Header Validation
  const headerMap = new Map<string, string>(); // canonical -> raw
  const duplicateHeaders = new Set<string>();

  for (const rawHeader of parsed.headers) {
    const canonical = normalizeHeader(rawHeader);
    if (headerMap.has(canonical)) {
      duplicateHeaders.add(rawHeader);
    } else {
      headerMap.set(canonical, rawHeader);
    }
  }

  if (duplicateHeaders.size > 0) {
    throw new ValidationError(
      `Duplicate CSV headers detected: ${Array.from(duplicateHeaders).join(", ")}.`
    );
  }

  const requiredCanonicalHeaders = ["name", "sku", "productType", "category"];
  const missingHeaders = requiredCanonicalHeaders.filter((h) => !headerMap.has(h));
  if (missingHeaders.length > 0) {
    throw new ValidationError(
      `Missing required CSV headers: ${missingHeaders.join(", ")}.`
    );
  }

  if (parsed.rows.length === 0) {
    throw new ValidationError("CSV file contains headers but no data rows.");
  }

  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(
      `CSV exceeds maximum allowable rows of ${MAX_IMPORT_ROWS}. Found ${parsed.rows.length} rows.`
    );
  }

  // 2. Preload Reference Data in Batches to avoid N+1 queries
  const [existingCategories, existingCollections] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, name: true, slug: true, isActive: true },
    }),
    prisma.collection.findMany({
      select: { id: true, name: true, slug: true, isActive: true },
    }),
  ]);

  const categoryLookup = new Map<string, (typeof existingCategories)[0]>();
  for (const cat of existingCategories) {
    categoryLookup.set(cat.id.toLowerCase(), cat);
    categoryLookup.set(cat.slug.toLowerCase(), cat);
    categoryLookup.set(cat.name.toLowerCase(), cat);
  }

  const collectionLookup = new Map<string, (typeof existingCollections)[0]>();
  for (const col of existingCollections) {
    collectionLookup.set(col.id.toLowerCase(), col);
    collectionLookup.set(col.slug.toLowerCase(), col);
    collectionLookup.set(col.name.toLowerCase(), col);
  }

  // 3. Scan all SKUs and Slugs to perform preloaded DB checks
  const candidateSkus = new Set<string>();
  const candidateSlugs = new Set<string>();

  for (const row of parsed.rows) {
    const rawSku = getRowValue(row.data, headerMap, "sku");
    if (rawSku) candidateSkus.add(rawSku.trim());

    const rawName = getRowValue(row.data, headerMap, "name");
    const rawSlug = getRowValue(row.data, headerMap, "slug");
    if (rawSlug && rawSlug.trim()) {
      candidateSlugs.add(rawSlug.trim().toLowerCase());
    } else if (rawName && rawName.trim()) {
      const gen = generateSlug(rawName.trim());
      if (gen) candidateSlugs.add(gen);
    }
  }

  const [existingVariantsWithSku, existingProductsWithSlug] = await Promise.all([
    candidateSkus.size > 0
      ? prisma.productVariant.findMany({
          where: { sku: { in: Array.from(candidateSkus) } },
          select: { sku: true, productId: true },
        })
      : [],
    candidateSlugs.size > 0
      ? prisma.product.findMany({
          where: { slug: { in: Array.from(candidateSlugs) } },
          select: { slug: true, id: true },
        })
      : [],
  ]);

  const existingVariantSkusSet = new Set(
    existingVariantsWithSku.map((v) => v.sku?.toLowerCase()).filter(Boolean)
  );
  const existingProductSlugsSet = new Set(
    existingProductsWithSlug.map((p) => p.slug.toLowerCase())
  );

  // 4. Track occurrences inside CSV for duplicate detection within the file
  const skuOccurrences = new Map<string, number[]>(); // sku (lowercased) -> row numbers
  const slugOccurrences = new Map<string, number[]>(); // slug -> row numbers

  for (const row of parsed.rows) {
    const rawSku = getRowValue(row.data, headerMap, "sku")?.trim().toLowerCase();
    if (rawSku) {
      const rows = skuOccurrences.get(rawSku) || [];
      rows.push(row.rowNumber);
      skuOccurrences.set(rawSku, rows);
    }

    const rawName = getRowValue(row.data, headerMap, "name")?.trim();
    const rawSlug = getRowValue(row.data, headerMap, "slug")?.trim().toLowerCase();
    const resolvedSlug = rawSlug || (rawName ? generateSlug(rawName) : "");
    if (resolvedSlug) {
      const rows = slugOccurrences.get(resolvedSlug) || [];
      rows.push(row.rowNumber);
      slugOccurrences.set(resolvedSlug, rows);
    }
  }

  // 5. Row-by-Row Validation
  const rowResults: CsvValidationRowResult[] = [];
  const referencedCategoryIds = new Set<string>();
  const referencedCollectionIds = new Set<string>();
  let existingSkuConflictCount = 0;

  for (const row of parsed.rows) {
    const errors: string[] = [];
    const rawName = getRowValue(row.data, headerMap, "name") || "";
    const rawSku = getRowValue(row.data, headerMap, "sku") || "";
    const rawType = getRowValue(row.data, headerMap, "productType") || "";
    const rawCategory = getRowValue(row.data, headerMap, "category") || "";
    const rawCollection = getRowValue(row.data, headerMap, "collection") || "";
    const rawSlug = getRowValue(row.data, headerMap, "slug") || "";
    const rawPrice = getRowValue(row.data, headerMap, "price");
    const rawRate = getRowValue(row.data, headerMap, "rate");
    const rawWastage = getRowValue(row.data, headerMap, "wastage");
    const rawMinArea = getRowValue(row.data, headerMap, "minArea");
    const rawRollWidth = getRowValue(row.data, headerMap, "rollWidth");
    const rawReturnable = getRowValue(row.data, headerMap, "returnable");
    const rawIsActive = getRowValue(row.data, headerMap, "isActive");
    const rawHsnCode = getRowValue(row.data, headerMap, "hsnCode");
    const rawDescription = getRowValue(row.data, headerMap, "description");

    // A. Name validation
    const name = rawName.trim();
    if (!name) {
      errors.push("Product name is required.");
    } else if (name.length > 200) {
      errors.push("Product name cannot exceed 200 characters.");
    } else if (/[\x00-\x1F\x7F]/.test(name)) {
      errors.push("Product name contains invalid control characters.");
    }

    // B. SKU validation
    const sku = rawSku.trim();
    if (!sku) {
      errors.push("SKU is required.");
    } else if (sku.length > 50) {
      errors.push("SKU cannot exceed 50 characters.");
    } else if (!/^[a-zA-Z0-9_\-]+$/.test(sku)) {
      errors.push(
        "SKU contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed."
      );
    } else {
      // Check duplicate within CSV
      const occ = skuOccurrences.get(sku.toLowerCase());
      if (occ && occ.length > 1) {
        errors.push(
          `Duplicate SKU '${sku}' found in CSV (Row ${occ.join(", Row ")}).`
        );
      }
      // Check existing in DB
      if (existingVariantSkusSet.has(sku.toLowerCase())) {
        errors.push(`A product or variant with SKU '${sku}' already exists.`);
        existingSkuConflictCount++;
      }
    }

    // C. Product Type validation
    const normalizedType = rawType.trim().toUpperCase();
    let productType: ProductType | null = null;
    if (normalizedType === "PER_AREA" || normalizedType === "FIXED") {
      productType = normalizedType as ProductType;
    } else {
      errors.push("Product type is invalid. Must be 'PER_AREA' or 'FIXED'.");
    }

    // D. Category resolution
    let resolvedCategory: (typeof existingCategories)[0] | null = null;
    const catInput = rawCategory.trim();
    if (!catInput) {
      errors.push("Category is required.");
    } else {
      resolvedCategory = categoryLookup.get(catInput.toLowerCase()) || null;
      if (!resolvedCategory) {
        errors.push(`Category '${catInput}' does not exist in catalogue.`);
      } else {
        referencedCategoryIds.add(resolvedCategory.name);
      }
    }

    // E. Collection resolution (optional, but must exist if specified)
    let resolvedCollection: (typeof existingCollections)[0] | null = null;
    const colInput = rawCollection.trim();
    if (colInput) {
      resolvedCollection = collectionLookup.get(colInput.toLowerCase()) || null;
      if (!resolvedCollection) {
        errors.push(`Collection '${colInput}' does not exist in catalogue.`);
      } else {
        referencedCollectionIds.add(resolvedCollection.name);
      }
    }

    // F. Slug validation
    let slug = "";
    if (rawSlug.trim()) {
      slug = rawSlug.trim().toLowerCase();
      if (!validateSlug(slug)) {
        errors.push("Slug format is invalid. Must be URL-safe (lowercase, alphanumeric, hyphens).");
      }
    } else if (name) {
      slug = generateSlug(name);
      if (!slug) {
        errors.push("Unable to auto-generate a valid slug from product name.");
      }
    }

    if (slug) {
      const occ = slugOccurrences.get(slug);
      if (occ && occ.length > 1) {
        errors.push(
          `Duplicate slug '${slug}' found in CSV (Row ${occ.join(", Row ")}).`
        );
      }
      if (existingProductSlugsSet.has(slug)) {
        errors.push(`A product with slug '${slug}' already exists.`);
      }
    }

    // G. Pricing & Type-specific fields
    let pricePaise: number | null = null;
    let ratePaise: number | null = null;
    let wastage: number | null = null;
    let minArea: number | null = null;
    let rollWidth: number | null = null;
    let displayPriceRupees: number | null = null;
    let displayRateRupees: number | null = null;

    if (productType === ProductType.FIXED) {
      // Must have price
      if (rawPrice === undefined || rawPrice === null || rawPrice === "") {
        errors.push("Fixed price is required for FIXED products.");
      } else {
        const num = Number(rawPrice);
        if (isNaN(num) || num <= 0) {
          errors.push("Fixed price must be a positive number.");
        } else {
          displayPriceRupees = num;
          pricePaise = Math.round(num * 100);
        }
      }

      // FIXED cannot specify PER_AREA fields
      if (rawRate !== undefined && rawRate !== null && rawRate.trim() !== "") {
        errors.push("Product type FIXED cannot specify rate per sqft.");
      }
      if (rawWastage !== undefined && rawWastage !== null && rawWastage.trim() !== "") {
        errors.push("Product type FIXED cannot specify wastage.");
      }
      if (rawMinArea !== undefined && rawMinArea !== null && rawMinArea.trim() !== "") {
        errors.push("Product type FIXED cannot specify minimum area.");
      }
      if (rawRollWidth !== undefined && rawRollWidth !== null && rawRollWidth.trim() !== "") {
        errors.push("Product type FIXED cannot specify roll width.");
      }
    } else if (productType === ProductType.PER_AREA) {
      // Must have rate
      if (rawRate === undefined || rawRate === null || rawRate === "") {
        errors.push("Rate per sqft is required for PER_AREA products.");
      } else {
        const num = Number(rawRate);
        if (isNaN(num) || num <= 0) {
          errors.push("Rate per sqft must be a positive number.");
        } else {
          displayRateRupees = num;
          ratePaise = Math.round(num * 100);
        }
      }

      // PER_AREA cannot specify fixed price
      if (rawPrice !== undefined && rawPrice !== null && rawPrice.trim() !== "") {
        errors.push("Product type PER_AREA cannot specify fixed price.");
      }

      // Wastage percentage (0 - 100)
      if (rawWastage !== undefined && rawWastage !== null && rawWastage.trim() !== "") {
        const num = Number(rawWastage);
        if (isNaN(num) || num < 0 || num > 100) {
          errors.push("Wastage must be a number between 0 and 100 percent.");
        } else {
          wastage = num;
        }
      } else {
        wastage = 0;
      }

      // Min Area (>= 0)
      if (rawMinArea !== undefined && rawMinArea !== null && rawMinArea.trim() !== "") {
        const num = Number(rawMinArea);
        if (isNaN(num) || num < 0) {
          errors.push("Minimum area must be a non-negative number.");
        } else {
          minArea = num;
        }
      }

      // Roll Width (> 0)
      if (rawRollWidth !== undefined && rawRollWidth !== null && rawRollWidth.trim() !== "") {
        const num = Number(rawRollWidth);
        if (isNaN(num) || num <= 0) {
          errors.push("Roll width must be greater than zero.");
        } else {
          rollWidth = num;
        }
      }
    }

    // H. HSN Code
    let hsnCode: string | null = null;
    if (rawHsnCode && rawHsnCode.trim()) {
      hsnCode = rawHsnCode.trim();
      if (hsnCode.length > 20) {
        errors.push("HSN code cannot exceed 20 characters.");
      } else if (!/^[a-zA-Z0-9.\-\s]+$/.test(hsnCode)) {
        errors.push("HSN code contains invalid characters.");
      }
    }

    // I. Description
    let description: string | null = null;
    if (rawDescription && rawDescription.trim()) {
      description = rawDescription.trim();
      if (description.length > 2000) {
        errors.push("Description cannot exceed 2000 characters.");
      }
    }

    // J. Flags
    const returnable = parseBoolean(rawReturnable, true);
    const isActive = parseBoolean(rawIsActive, true);

    const isValid = errors.length === 0;

    let payload: ValidatedRowPayload | undefined = undefined;
    if (isValid && productType && resolvedCategory) {
      payload = {
        rowNumber: row.rowNumber,
        name,
        slug,
        sku,
        productType,
        categoryId: resolvedCategory.id,
        categoryName: resolvedCategory.name,
        collectionSlug: resolvedCollection ? resolvedCollection.slug : null,
        pricePaise,
        ratePaise,
        wastage,
        minArea,
        rollWidth,
        returnable,
        isActive,
        hsnCode,
        description,
      };
    }

    rowResults.push({
      rowNumber: row.rowNumber,
      sku: sku || `(Row ${row.rowNumber})`,
      name: name || `(Row ${row.rowNumber})`,
      slug: slug || "",
      productType: productType || normalizedType || "UNKNOWN",
      category: resolvedCategory ? resolvedCategory.name : catInput || "Missing",
      collection: resolvedCollection ? resolvedCollection.name : colInput || "",
      priceRupees: displayPriceRupees,
      rateRupees: displayRateRupees,
      status: isValid ? "valid" : "invalid",
      errors,
      payload,
    });
  }

  const validRowCount = rowResults.filter((r) => r.status === "valid").length;
  const invalidRowCount = rowResults.length - validRowCount;

  return {
    totalRows: rowResults.length,
    validRows: validRowCount,
    invalidRows: invalidRowCount,
    newProducts: validRowCount,
    existingSkuConflicts: existingSkuConflictCount,
    categoriesReferenced: Array.from(referencedCategoryIds),
    collectionsReferenced: Array.from(referencedCollectionIds),
    rows: rowResults,
    canImport: validRowCount > 0 && invalidRowCount === 0, // Safe default: requires all rows to be valid or explicit clean sheet
  };
}

/**
 * Extracts a value from a row's data record using the canonical header mapping.
 */
function getRowValue(
  data: Record<string, string>,
  headerMap: Map<string, string>,
  canonicalField: string
): string | undefined {
  const rawKey = headerMap.get(canonicalField);
  if (!rawKey) return undefined;
  return data[rawKey];
}

/**
 * Executes database import in a single atomic transaction.
 * Creates Product records, initial ProductVariant for FIXED items, and logs audit events.
 */
export async function executeCsvImport(
  validatedRows: ValidatedRowPayload[],
  actor: CurrentUser,
  reqContext?: RequestContext
): Promise<CsvImportExecutionResult> {
  if (!Array.isArray(validatedRows) || validatedRows.length === 0) {
    throw new ValidationError("No valid product rows provided for import.");
  }

  if (validatedRows.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(`Batch size exceeds maximum limit of ${MAX_IMPORT_ROWS} rows.`);
  }

  const importId = `imp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  // Record audit import started
  await recordAuditEvent({
    actorUserId: actor.id,
    action: AUDIT_ACTIONS.PRODUCT_IMPORT_STARTED,
    resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_IMPORT,
    resourceId: importId,
    metadata: {
      totalRows: validatedRows.length,
      importId,
    },
    ipAddress: reqContext?.ipAddress || null,
    userAgent: reqContext?.userAgent || null,
  });

  try {
    const createdProducts: Array<{ id: string; sku: string; name: string; slug: string }> = [];

    // Atomic transaction: All or nothing
    await prisma.$transaction(
      async (tx) => {
        // 1. Double check SKU uniqueness inside transaction to prevent concurrent collisions
        const skusToCheck = validatedRows.map((r) => r.sku);
        const existingVariants = await tx.productVariant.findMany({
          where: { sku: { in: skusToCheck } },
          select: { sku: true },
        });

        if (existingVariants.length > 0) {
          const conflicting = existingVariants.map((v) => v.sku).filter(Boolean).join(", ");
          throw new ValidationError(
            `Concurrent import conflict: SKU(s) already exist in database: ${conflicting}`
          );
        }

        // 2. Double check Slug uniqueness inside transaction
        const slugsToCheck = validatedRows.map((r) => r.slug);
        const existingProducts = await tx.product.findMany({
          where: { slug: { in: slugsToCheck } },
          select: { slug: true },
        });

        if (existingProducts.length > 0) {
          const conflicting = existingProducts.map((p) => p.slug).join(", ");
          throw new ValidationError(
            `Concurrent import conflict: Slug(s) already exist in database: ${conflicting}`
          );
        }

        // 3. Create records
        for (const row of validatedRows) {
          const product = await tx.product.create({
            data: {
              name: row.name,
              slug: row.slug,
              description: row.description,
              productType: row.productType,
              isActive: row.isActive,
              price: row.pricePaise,
              rate: row.ratePaise,
              wastage: row.wastage,
              minArea: row.minArea,
              rollWidth: row.rollWidth,
              returnable: row.returnable,
              hsnCode: row.hsnCode,
              categoryId: row.categoryId,
            },
          });

          // For FIXED products, create initial ProductVariant with row SKU & price
          if (row.productType === ProductType.FIXED) {
            await tx.productVariant.create({
              data: {
                productId: product.id,
                name: row.name,
                sku: row.sku,
                price: row.pricePaise!,
                isActive: row.isActive,
                sortOrder: 0,
              },
            });
          }

          createdProducts.push({
            id: product.id,
            sku: row.sku,
            name: product.name,
            slug: product.slug,
          });
        }

        // Record audit import completed inside transaction
        await recordAuditEvent(
          {
            actorUserId: actor.id,
            action: AUDIT_ACTIONS.PRODUCT_IMPORT_COMPLETED,
            resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_IMPORT,
            resourceId: importId,
            metadata: {
              totalRows: validatedRows.length,
              importedCount: createdProducts.length,
              importId,
              createdSkus: createdProducts.map((p) => p.sku),
            },
            ipAddress: reqContext?.ipAddress || null,
            userAgent: reqContext?.userAgent || null,
          },
          tx
        );
      },
      {
        timeout: 30000, // 30s timeout for batch import
      }
    );

    return {
      totalRows: validatedRows.length,
      importedCount: createdProducts.length,
      failedCount: 0,
      createdProducts,
      importId,
    };
  } catch (error) {
    // Record audit import failed on error
    try {
      await recordAuditEvent({
        actorUserId: actor.id,
        action: AUDIT_ACTIONS.PRODUCT_IMPORT_FAILED,
        resourceType: AUDIT_RESOURCE_TYPES.PRODUCT_IMPORT,
        resourceId: importId,
        metadata: {
          totalRows: validatedRows.length,
          importId,
          error: error instanceof Error ? error.message : "Unknown import failure",
        },
        ipAddress: reqContext?.ipAddress || null,
        userAgent: reqContext?.userAgent || null,
      });
    } catch {
      // silent fallback for audit logging on failure
    }

    throw error;
  }
}

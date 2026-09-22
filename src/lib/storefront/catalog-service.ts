import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, ProductType } from "@prisma/client";
import { logger } from "@/lib/logger";

export interface StorefrontNavData {
  categories: Array<{ id: string; name: string; slug: string }>;
  collections: Array<{ id: string; name: string; slug: string }>;
}

export interface StorefrontProductListingItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productType: ProductType;
  price: number | null;
  rate: number | null;
  returnable: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  media: Array<{
    id: string;
    objectKey: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  }>;
}

export interface StorefrontProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productType: ProductType;
  price: number | null;
  rate: number | null;
  wastage: number | null;
  minArea: number | null;
  rollWidth: number | null;
  returnable: boolean;
  hsnCode: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
  media: Array<{
    id: string;
    objectKey: string;
    altText: string | null;
    width: number | null;
    height: number | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    name: string;
    sku: string | null;
    price: number;
    isActive: boolean;
    sortOrder: number;
  }>;
}

export interface StorefrontProductsQueryOptions {
  search?: string;
  category?: string;
  collection?: string;
  type?: "all" | "PER_AREA" | "FIXED" | string;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | string;
  page?: number | string;
  pageSize?: number | string;
}

export interface StorefrontCatalogResult {
  items: StorefrontProductListingItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  activeCategory?: { id: string; name: string; slug: string; description?: string | null } | null;
  activeCollection?: { id: string; name: string; slug: string; description?: string | null } | null;
}

export const ALLOWED_CATALOG_SORTS = new Set([
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
]);

/**
 * Retrieve active categories and collections for public storefront navigation.
 * Only returns active records sorted by sortOrder ASC.
 */
export async function getStorefrontNavData(): Promise<StorefrontNavData> {
  try {
    const [categories, collections] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.collection.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

    return { categories, collections };
  } catch (error) {
    logger.error("Failed to load storefront navigation data", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { categories: [], collections: [] };
  }
}

/**
 * Server-side catalog query engine for product listing (PLP).
 * Enforces:
 * - Active products only (isActive = true).
 * - Exact 1 primary media item per product (no N+1).
 * - Whitelisted sort keys.
 * - Server-side pagination.
 */
export async function getStorefrontProducts(
  options: StorefrontProductsQueryOptions = {}
): Promise<StorefrontCatalogResult> {
  const page = Math.max(1, parseInt(String(options.page || 1), 10) || 1);
  const rawPageSize = parseInt(String(options.pageSize || 12), 10) || 12;
  const pageSize = Math.min(48, Math.max(1, rawPageSize));

  const search = typeof options.search === "string" ? options.search.trim() : "";
  const rawType = typeof options.type === "string" ? options.type.trim() : "all";
  const rawSort = typeof options.sort === "string" ? options.sort.trim() : "newest";
  const sort = ALLOWED_CATALOG_SORTS.has(rawSort) ? rawSort : "newest";
  const categoryParam = typeof options.category === "string" ? options.category.trim() : "";
  const collectionParam = typeof options.collection === "string" ? options.collection.trim() : "";

  // 1. Resolve Category context if requested
  let activeCategory: { id: string; name: string; slug: string; description: string | null } | null = null;
  if (categoryParam && categoryParam !== "all") {
    activeCategory = await prisma.category.findFirst({
      where: {
        isActive: true,
        OR: [{ slug: categoryParam }, { id: categoryParam }],
      },
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  // 2. Resolve Collection context if requested
  let activeCollection: { id: string; name: string; slug: string; description: string | null } | null = null;
  if (collectionParam && collectionParam !== "all") {
    activeCollection = await prisma.collection.findFirst({
      where: {
        isActive: true,
        OR: [{ slug: collectionParam }, { id: collectionParam }],
      },
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  // If an unknown category was requested, return clean empty result immediately
  if (categoryParam && categoryParam !== "all" && !activeCategory) {
    return {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      activeCategory: null,
      activeCollection,
    };
  }

  // If an unknown collection was requested, return clean empty result immediately
  if (collectionParam && collectionParam !== "all" && !activeCollection) {
    return {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      activeCategory,
      activeCollection: null,
    };
  }

  // Note: Product-to-Collection schema relation is introduced in future phases.
  // If activeCollection is filtered and no products are assigned yet, return clean empty list
  if (activeCollection) {
    return {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      activeCategory,
      activeCollection,
    };
  }

  // 3. Build Prisma where condition
  const where: Prisma.ProductWhereInput = {
    isActive: true, // Strict storefront guard: never expose inactive or draft products
  };

  if (activeCategory) {
    where.categoryId = activeCategory.id;
  }

  if (rawType === "PER_AREA" || rawType === "FIXED") {
    where.productType = rawType as ProductType;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  // 4. Build Sort Order
  let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
  switch (sort) {
    case "price_asc":
      orderBy = [{ price: "asc" }, { rate: "asc" }];
      break;
    case "price_desc":
      orderBy = [{ price: "desc" }, { rate: "desc" }];
      break;
    case "name_asc":
      orderBy = { name: "asc" };
      break;
    case "name_desc":
      orderBy = { name: "desc" };
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
      break;
  }

  // 5. Execute count and paginated query concurrently
  const [totalCount, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        productType: true,
        price: true,
        rate: true,
        returnable: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        media: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
          take: 1,
          select: {
            id: true,
            objectKey: true,
            altText: true,
            width: true,
            height: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    items,
    totalCount,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
    activeCategory,
    activeCollection,
  };
}

/**
 * Server-side product detail query for PDP.
 * Enforces:
 * - Active product only (isActive = true).
 * - Full media gallery sorted by isPrimary DESC, sortOrder ASC.
 * - Active variants only (isActive = true) sorted by sortOrder ASC.
 * - Category metadata.
 * - Zero N+1 queries.
 */
export async function getStorefrontProductBySlug(
  slug: string
): Promise<StorefrontProductDetail | null> {
  const normalizedSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!normalizedSlug) {
    return null;
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        slug: normalizedSlug,
        isActive: true, // Strict storefront guard: never expose inactive/draft products
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        productType: true,
        price: true,
        rate: true,
        wastage: true,
        minArea: true,
        rollWidth: true,
        returnable: true,
        hsnCode: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
          },
        },
        media: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            id: true,
            objectKey: true,
            altText: true,
            width: true,
            height: true,
            isPrimary: true,
            sortOrder: true,
          },
        },
        variants: {
          where: {
            isActive: true,
          },
          orderBy: [
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            isActive: true,
            sortOrder: true,
          },
        },
      },
    });

    return product;
  } catch (error) {
    logger.error("Failed to load storefront product by slug", {
      slug: normalizedSlug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}


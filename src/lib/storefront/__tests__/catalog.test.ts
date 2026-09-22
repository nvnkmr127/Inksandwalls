import assert from "node:assert";
import { formatPaiseToRupees, formatProductPriceDisplay } from "@/lib/money";
import {
  getStorefrontNavData,
  getStorefrontProducts,
  ALLOWED_CATALOG_SORTS,
} from "../catalog-service";
import { prisma } from "@/lib/prisma";

async function runCatalogStorefrontTests() {
  console.log("Running Storefront Catalog Tests (Micro-Phase 05.01)...");

  // ==========================================
  // 1. Money & Pricing Formatter Unit Tests
  // ==========================================
  console.log("--- 1. Testing Storefront Pricing Display ---");

  // Paise to Rupees
  assert.strictEqual(formatPaiseToRupees(499900), "₹4,999");
  assert.strictEqual(formatPaiseToRupees(15000), "₹150");
  assert.strictEqual(formatPaiseToRupees(0), "₹0");

  // PER_AREA product formatting
  const perAreaPricing = formatProductPriceDisplay({
    productType: "PER_AREA",
    rate: 18000, // ₹180/sqft
    price: null,
  });
  assert.strictEqual(perAreaPricing.formattedPrice, "₹180");
  assert.strictEqual(perAreaPricing.unitLabel, "/ sq ft");
  assert.strictEqual(perAreaPricing.displayString, "From ₹180 / sq ft");

  // FIXED product formatting
  const fixedPricing = formatProductPriceDisplay({
    productType: "FIXED",
    price: 349900, // ₹3,499
    rate: null,
  });
  assert.strictEqual(fixedPricing.formattedPrice, "₹3,499");
  assert.strictEqual(fixedPricing.unitLabel, undefined);
  assert.strictEqual(fixedPricing.displayString, "₹3,499");

  // Null/zero price fallbacks
  const missingPricing = formatProductPriceDisplay({
    productType: "FIXED",
    price: null,
  });
  assert.strictEqual(missingPricing.displayString, "Price on request");

  console.log("✔ Pricing display and minor unit currency formatters verified");

  // ==========================================
  // 2. Navigation Query Tests
  // ==========================================
  console.log("--- 2. Testing Storefront Navigation Queries ---");

  const origCatFindMany = prisma.category.findMany;
  const origColFindMany = prisma.collection.findMany;

  let queriedCategoryWhere: unknown = null;
  let queriedCollectionWhere: unknown = null;

  (prisma.category.findMany as unknown) = async (args: { where?: unknown }) => {
    queriedCategoryWhere = args?.where;
    return [
      { id: "cat-1", name: "Wallpapers", slug: "wallpapers" },
      { id: "cat-2", name: "Wall Murals", slug: "wall-murals" },
    ];
  };

  (prisma.collection.findMany as unknown) = async (args: { where?: unknown }) => {
    queriedCollectionWhere = args?.where;
    return [
      { id: "col-1", name: "Botanical", slug: "botanical" },
      { id: "col-2", name: "Minimalist", slug: "minimalist" },
    ];
  };

  const navData = await getStorefrontNavData();
  assert.strictEqual(navData.categories.length, 2);
  assert.strictEqual(navData.collections.length, 2);
  // Strictly enforce active-only filter
  assert.deepStrictEqual(queriedCategoryWhere, { isActive: true });
  assert.deepStrictEqual(queriedCollectionWhere, { isActive: true });

  console.log("✔ Navigation data strictly fetches active categories and collections");

  // ==========================================
  // 3. Catalog Query Layer & Security Whitelist Tests
  // ==========================================
  console.log("--- 3. Testing Catalog Query Engine & Security ---");

  const origCatFindFirst = prisma.category.findFirst;
  const origColFindFirst = prisma.collection.findFirst;

  let capturedWhere: Record<string, unknown> = {};
  let capturedOrderBy: unknown = null;
  let capturedSkip = 0;
  let capturedTake = 0;

  // Mock product.count & findMany
  const origProdCount = prisma.product.count;
  const origProdFindMany = prisma.product.findMany;

  (prisma.product.count as unknown) = async (args: { where: Record<string, unknown> }) => {
    capturedWhere = args.where;
    return 25;
  };

  (prisma.product.findMany as unknown) = async (args: {
    where: Record<string, unknown>;
    orderBy: unknown;
    skip: number;
    take: number;
    select: { media: { take: number } };
  }) => {
    capturedWhere = args.where;
    capturedOrderBy = args.orderBy;
    capturedSkip = args.skip;
    capturedTake = args.take;

    // Verify single primary media query optimization (take: 1, no N+1)
    assert.strictEqual(args.select.media.take, 1);

    return [
      {
        id: "prod-1",
        name: "Vintage Botanical Wallpaper",
        slug: "vintage-botanical-wallpaper",
        description: "Elegant floral wallpaper",
        productType: "PER_AREA",
        price: null,
        rate: 18000,
        returnable: false,
        category: { id: "cat-1", name: "Wallpapers", slug: "wallpapers" },
        media: [
          {
            id: "med-1",
            objectKey: "uploads/products/prod-1/primary.webp",
            altText: "Vintage Botanical Wallpaper in living room",
            width: 1200,
            height: 1200,
          },
        ],
      },
    ];
  };

  // 3A. Active-only enforcement
  const defaultCatalog = await getStorefrontProducts({});
  assert.strictEqual(capturedWhere.isActive, true, "isActive MUST always be true in storefront queries");
  assert.strictEqual(defaultCatalog.items.length, 1);
  assert.strictEqual(defaultCatalog.totalCount, 25);
  assert.strictEqual(defaultCatalog.totalPages, 3); // ceil(25 / 12) = 3
  console.log("✔ Catalog strictly restricts results to active products (isActive: true)");

  // 3B. Whitelisted Sort Security
  // Test valid sort keys
  for (const validSort of ALLOWED_CATALOG_SORTS) {
    await getStorefrontProducts({ sort: validSort });
    assert.ok(capturedOrderBy != null, `Sort '${validSort}' must generate an orderBy clause`);
  }

  // Test SQL injection / arbitrary column sort attempt
  await getStorefrontProducts({ sort: "DROP TABLE users; --" });
  assert.deepStrictEqual(capturedOrderBy, { createdAt: "desc" }, "Unsupported sort must fallback to newest (createdAt desc)");

  await getStorefrontProducts({ sort: "hsnCode" });
  assert.deepStrictEqual(capturedOrderBy, { createdAt: "desc" }, "Non-whitelisted column sort must fallback to newest");
  console.log("✔ Controlled sort whitelist rejects arbitrary database fields and injection attempts");

  // 3C. Search Sanitization & Query
  await getStorefrontProducts({ search: "  Floral Wallpaper  " });
  assert.ok(Array.isArray(capturedWhere.OR), "Search query must produce OR condition");
  assert.deepStrictEqual(capturedWhere.OR, [
    { name: { contains: "Floral Wallpaper", mode: "insensitive" } },
    { description: { contains: "Floral Wallpaper", mode: "insensitive" } },
  ]);
  console.log("✔ Catalog search query normalized and sanitised with case-insensitive matching");

  // 3D. Category Filtering
  (prisma.category.findFirst as unknown) = async () => ({
    id: "cat-1",
    name: "Wallpapers",
    slug: "wallpapers",
    description: "Bespoke wallpapers",
  });

  const categoryResult = await getStorefrontProducts({ category: "wallpapers" });
  assert.strictEqual(capturedWhere.categoryId, "cat-1");
  assert.strictEqual(categoryResult.activeCategory?.slug, "wallpapers");
  console.log("✔ Category filter correctly binds resolved category ID to query where clause");

  // 3E. Non-existent Category Handling
  (prisma.category.findFirst as unknown) = async () => null;
  const missingCatResult = await getStorefrontProducts({ category: "non-existent-cat" });
  assert.strictEqual(missingCatResult.items.length, 0);
  assert.strictEqual(missingCatResult.totalCount, 0);
  console.log("✔ Missing or inactive category gracefully returns empty result without throwing");

  // 3F. Pagination Boundaries
  // Negative page
  await getStorefrontProducts({ page: -5, pageSize: 12 });
  assert.strictEqual(capturedSkip, 0, "Negative page must clamp to page 1 (skip: 0)");

  // Page 2
  await getStorefrontProducts({ page: 2, pageSize: 12 });
  assert.strictEqual(capturedSkip, 12, "Page 2 with pageSize 12 must have skip 12");
  assert.strictEqual(capturedTake, 12);

  // Clamped page size (max 48)
  await getStorefrontProducts({ pageSize: 500 });
  assert.strictEqual(capturedTake, 48, "Page size must be clamped to max 48");
  console.log("✔ Pagination boundary conditions and skip/take calculations verified");

  // ==========================================
  // Clean up mocks
  // ==========================================
  prisma.category.findMany = origCatFindMany;
  prisma.collection.findMany = origColFindMany;
  prisma.category.findFirst = origCatFindFirst;
  prisma.collection.findFirst = origColFindFirst;
  prisma.product.count = origProdCount;
  prisma.product.findMany = origProdFindMany;

  console.log("ALL STOREFRONT CATALOG TESTS PASSED SUCCESSFULLY! (Phase 05.01)");
}

runCatalogStorefrontTests().catch((err) => {
  console.error("Storefront Catalog Test Failure:", err);
  process.exit(1);
});

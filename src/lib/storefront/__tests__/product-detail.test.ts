import assert from "node:assert";
import { getStorefrontProductBySlug } from "../catalog-service";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@prisma/client";

async function runProductDetailStorefrontTests() {
  console.log("Running Storefront Product Detail Tests (Micro-Phase 05.03)...");

  const origFindFirst = prisma.product.findFirst;

  let capturedWhere: Record<string, unknown> = {};
  let capturedSelect: Record<string, unknown> = {};

  // Mock product record
  const mockProduct = {
    id: "prod-101",
    name: "Misty Pine Forest Mural",
    slug: "misty-pine-forest-mural",
    description: "Bespoke botanical wall mural printed to exact architectural dimensions.",
    productType: ProductType.PER_AREA,
    price: null,
    rate: 18000, // ₹180 / sqft in paise
    wastage: 10,
    minArea: 25,
    rollWidth: 3.0,
    returnable: false,
    hsnCode: "49119100",
    category: {
      id: "cat-1",
      name: "Botanical Murals",
      slug: "botanical-murals",
      description: "Lush botanical designs",
    },
    media: [
      {
        id: "med-1",
        objectKey: "products/prod-101/primary.webp",
        altText: "Misty pine forest wallpaper across modern living room",
        width: 2400,
        height: 1800,
        isPrimary: true,
        sortOrder: 0,
      },
      {
        id: "med-2",
        objectKey: "products/prod-101/detail.webp",
        altText: "Close-up texture of architectural canvas paper",
        width: 2400,
        height: 1800,
        isPrimary: false,
        sortOrder: 1,
      },
    ],
    variants: [],
  };

  (prisma.product.findFirst as unknown) = async (args: {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  }) => {
    capturedWhere = args.where;
    capturedSelect = args.select;

    if (args.where.slug === "misty-pine-forest-mural" && args.where.isActive === true) {
      return mockProduct;
    }
    return null;
  };

  try {
    // 1. Valid Product Resolution by Slug
    console.log("--- 1. Testing Product Detail Query by Slug ---");
    const product = await getStorefrontProductBySlug("misty-pine-forest-mural");

    assert.ok(product, "Product should be resolved");
    assert.strictEqual(product?.id, "prod-101");
    assert.strictEqual(product?.slug, "misty-pine-forest-mural");
    assert.strictEqual(product?.productType, "PER_AREA");
    assert.strictEqual(product?.rate, 18000);
    assert.strictEqual(product?.wastage, 10);
    assert.strictEqual(product?.minArea, 25);
    assert.strictEqual(product?.returnable, false);

    // Verify Prisma query guards
    assert.strictEqual(capturedWhere.slug, "misty-pine-forest-mural");
    assert.strictEqual(capturedWhere.isActive, true, "Storefront query MUST guard isActive: true");
    assert.strictEqual(Boolean(capturedSelect.media), true, "Storefront query MUST select media");

    // Verify Media ordering and fields
    assert.strictEqual(product?.media.length, 2);
    assert.strictEqual(product?.media[0].isPrimary, true);
    assert.strictEqual(product?.media[0].altText, "Misty pine forest wallpaper across modern living room");

    console.log("✔ Product detail query and visibility guards verified");

    // 2. Inactive / Missing Product Handling
    console.log("--- 2. Testing Missing / Inactive Product Handling ---");
    const missingProduct = await getStorefrontProductBySlug("non-existent-slug");
    assert.strictEqual(missingProduct, null, "Non-existent product should return null");

    const emptySlugProduct = await getStorefrontProductBySlug("");
    assert.strictEqual(emptySlugProduct, null, "Empty slug should return null immediately");

    console.log("✔ Non-existent and empty slugs handled cleanly");

    // 3. FIXED Product with Variants Query
    console.log("--- 3. Testing FIXED Product with Active Variants ---");
    const mockFixedProduct = {
      id: "prod-202",
      name: "Abstract Geometric Art",
      slug: "abstract-geometric-art",
      description: "Fine art framed print.",
      productType: ProductType.FIXED,
      price: 299900,
      rate: null,
      wastage: null,
      minArea: null,
      rollWidth: null,
      returnable: true,
      hsnCode: "49119900",
      category: {
        id: "cat-2",
        name: "Wall Art",
        slug: "wall-art",
        description: "Curated art prints",
      },
      media: [],
      variants: [
        { id: "var-1", name: "A3 Framed (Black)", sku: "GEO-A3-BLK", price: 299900, isActive: true, sortOrder: 0 },
        { id: "var-2", name: "A2 Framed (Natural Oak)", sku: "GEO-A2-OAK", price: 449900, isActive: true, sortOrder: 1 },
      ],
    };

    (prisma.product.findFirst as unknown) = async (args: {
      where: Record<string, unknown>;
    }) => {
      if (args.where.slug === "abstract-geometric-art" && args.where.isActive === true) {
        return mockFixedProduct;
      }
      return null;
    };

    const fixedProduct = await getStorefrontProductBySlug("abstract-geometric-art");
    assert.ok(fixedProduct);
    assert.strictEqual(fixedProduct?.productType, "FIXED");
    assert.strictEqual(fixedProduct?.variants.length, 2);
    assert.strictEqual(fixedProduct?.variants[0].name, "A3 Framed (Black)");
    assert.strictEqual(fixedProduct?.variants[1].price, 449900);

    console.log("✔ FIXED product with active variants verified");
  } finally {
    prisma.product.findFirst = origFindFirst;
  }

  console.log("ALL PRODUCT DETAIL STOREFRONT TESTS PASSED SUCCESSFULLY! (Phase 05.03)");
}

export { runProductDetailStorefrontTests };

if (require.main === module) {
  runProductDetailStorefrontTests().catch((err) => {
    console.error("Product detail test failed:", err);
    process.exit(1);
  });
}


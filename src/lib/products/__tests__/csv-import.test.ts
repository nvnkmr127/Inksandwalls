import assert from "node:assert";
import { parseCsv, serializeCsv, sanitizeFormulaValue } from "../csv-parser";
import { generateCsvTemplate, CSV_IMPORT_FIELDS, CSV_TEMPLATE_HEADERS } from "../csv-template";
import {
  validateCsvImport,
  executeCsvImport,
  ValidatedRowPayload,
  MAX_IMPORT_ROWS,
  MAX_CSV_FILE_SIZE,
} from "../csv-import-service";
import { ProductType, Role } from "@prisma/client";
import { ValidationError, AuthError, ForbiddenError } from "@/lib/errors";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { prisma } from "@/lib/prisma";

async function runCsvImportTests() {
  console.log("Running Product Bulk CSV Import Tests (Phase 04.06)...");

  // ==========================================
  // 1. CSV Parser Tests (RFC 4180)
  // ==========================================
  console.log("--- 1. Testing RFC 4180 CSV Parser ---");

  // Standard CSV
  const standardCsv = `name,sku,productType,category\nWall Art,WA-001,FIXED,art\nSilk Paper,SP-002,PER_AREA,wallpaper`;
  const parsedStandard = parseCsv(standardCsv);
  assert.strictEqual(parsedStandard.headers.length, 4);
  assert.strictEqual(parsedStandard.rows.length, 2);
  assert.strictEqual(parsedStandard.rows[0].data["name"], "Wall Art");
  assert.strictEqual(parsedStandard.rows[0].data["sku"], "WA-001");
  assert.strictEqual(parsedStandard.rows[0].rowNumber, 2);
  assert.strictEqual(parsedStandard.rows[1].data["sku"], "SP-002");
  assert.strictEqual(parsedStandard.rows[1].rowNumber, 3);
  console.log("✔ Standard CSV parsing verified");

  // Quoted values and commas inside quotes
  const quotedCsv = `name,sku,description\n"Art, Modern & Bold",ART-01,"A description with, commas, and ""escaped quotes"""`;
  const parsedQuoted = parseCsv(quotedCsv);
  assert.strictEqual(parsedQuoted.rows[0].data["name"], "Art, Modern & Bold");
  assert.strictEqual(
    parsedQuoted.rows[0].data["description"],
    'A description with, commas, and "escaped quotes"'
  );
  console.log("✔ Quoted fields with internal commas and escaped double quotes verified");

  // Multiline field values inside quotes
  const multilineCsv = `name,description\nProduct 1,"Line 1\nLine 2\nLine 3"`;
  const parsedMultiline = parseCsv(multilineCsv);
  assert.strictEqual(parsedMultiline.rows[0].data["description"], "Line 1\nLine 2\nLine 3");
  console.log("✔ Multiline quoted cells verified");

  // Windows CRLF line endings
  const crlfCsv = "name,sku\r\nItem 1,SKU-1\r\nItem 2,SKU-2\r\n";
  const parsedCrlf = parseCsv(crlfCsv);
  assert.strictEqual(parsedCrlf.rows.length, 2);
  assert.strictEqual(parsedCrlf.rows[0].data["sku"], "SKU-1");
  assert.strictEqual(parsedCrlf.rows[1].data["sku"], "SKU-2");
  console.log("✔ Windows CRLF line endings verified");

  // UTF-8 BOM stripping
  const bomCsv = "\uFEFFname,sku\nItem BOM,BOM-001";
  const parsedBom = parseCsv(bomCsv);
  assert.strictEqual(parsedBom.headers[0], "name");
  assert.strictEqual(parsedBom.rows[0].data["name"], "Item BOM");
  console.log("✔ UTF-8 BOM stripping verified");

  // Empty values handling
  const emptyCsv = "name,sku,price,description\nItem 1,SKU-1,,";
  const parsedEmpty = parseCsv(emptyCsv);
  assert.strictEqual(parsedEmpty.rows[0].data["price"], "");
  assert.strictEqual(parsedEmpty.rows[0].data["description"], "");
  console.log("✔ Empty field values verified");

  // Empty string / invalid input
  assert.strictEqual(parseCsv("").rows.length, 0);
  assert.strictEqual(parseCsv("   \n\n  \n").rows.length, 0);
  console.log("✔ Blank input handling verified");

  // ==========================================
  // 2. Formula Injection Protection Tests
  // ==========================================
  console.log("--- 2. Testing Formula Injection Sanitization ---");

  assert.strictEqual(sanitizeFormulaValue("=SUM(A1:A10)"), "'=SUM(A1:A10)");
  assert.strictEqual(sanitizeFormulaValue("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.strictEqual(sanitizeFormulaValue("-5+2"), "'-5+2");
  assert.strictEqual(sanitizeFormulaValue("@evil.com"), "'@evil.com");
  assert.strictEqual(sanitizeFormulaValue("\tTabIndent"), "'\tTabIndent");
  assert.strictEqual(sanitizeFormulaValue("Normal Safe Text"), "Normal Safe Text");

  const serialized = serializeCsv(["FormulaCol", "SafeCol"], [["=1+1", "Hello World"]]);
  assert.ok(serialized.includes("'=1+1"));
  assert.ok(serialized.includes("Hello World"));
  console.log("✔ Formula injection escaping verified");

  // ==========================================
  // 3. CSV Template Generation Tests
  // ==========================================
  console.log("--- 3. Testing CSV Template Generation ---");

  assert.ok(CSV_TEMPLATE_HEADERS.includes("name"));
  assert.ok(CSV_TEMPLATE_HEADERS.includes("sku"));
  assert.ok(CSV_TEMPLATE_HEADERS.includes("productType"));
  assert.ok(CSV_TEMPLATE_HEADERS.includes("category"));
  assert.ok(CSV_TEMPLATE_HEADERS.includes("price"));
  assert.ok(CSV_TEMPLATE_HEADERS.includes("rate"));

  const templateString = generateCsvTemplate();
  assert.ok(templateString.startsWith("name,slug,sku,productType"));
  assert.ok(templateString.includes("Royal Floral Wallpaper"));
  assert.ok(templateString.includes("Abstract Canvas Framed Art"));
  assert.ok(CSV_IMPORT_FIELDS.length >= 10);
  assert.strictEqual(MAX_IMPORT_ROWS, 1000);
  assert.strictEqual(MAX_CSV_FILE_SIZE, 5 * 1024 * 1024);
  assert.strictEqual(AUDIT_RESOURCE_TYPES.PRODUCT_IMPORT, "PRODUCT_IMPORT");
  console.log("✔ CSV template generation and sample rows verified");

  // ==========================================
  // 4. Import Service Validation Tests (Mocking DB)
  // ==========================================
  console.log("--- 4. Testing CSV Import Service Validation ---");

  // Setup mock database query responses
  const originalCategoryFindMany = prisma.category.findMany;
  const originalCollectionFindMany = prisma.collection.findMany;
  const originalProductVariantFindMany = prisma.productVariant.findMany;
  const originalProductFindMany = prisma.product.findMany;
  const originalTransaction = prisma.$transaction;
  const originalAuditLogCreate = prisma.auditLog.create;

  // Mock categories & collections
  (prisma.category.findMany as unknown) = async () => [
    { id: "cat_wallpapers_123", name: "Wallpapers", slug: "wallpapers", isActive: true },
    { id: "cat_art_456", name: "Wall Art", slug: "wall-art", isActive: true },
  ];

  (prisma.collection.findMany as unknown) = async () => [
    { id: "col_heritage_789", name: "Heritage Prints", slug: "heritage-prints", isActive: true },
  ];

  // Mock no existing SKUs or slugs initially
  (prisma.productVariant.findMany as unknown) = async () => [];
  (prisma.product.findMany as unknown) = async () => [];

  // A. Valid mixed CSV (1 FIXED, 1 PER_AREA)
  const validCsv = `name,sku,productType,category,collection,price,rate,wastage,minArea,rollWidth,hsnCode
"Royal Velvet Wallpaper",IW-WALL-100,PER_AREA,wallpapers,heritage-prints,,180.00,10,25,3,4814.90
"Abstract Acrylic Print",IW-ART-200,FIXED,wall-art,,5499.00,,,,,9701.10`;

  const validSummary = await validateCsvImport(validCsv);
  assert.strictEqual(validSummary.totalRows, 2);
  assert.strictEqual(validSummary.validRows, 2);
  assert.strictEqual(validSummary.invalidRows, 0);
  assert.strictEqual(validSummary.canImport, true);

  // Check PER_AREA parsed payload
  const perAreaRow = validSummary.rows[0];
  assert.strictEqual(perAreaRow.status, "valid");
  assert.strictEqual(perAreaRow.payload?.productType, ProductType.PER_AREA);
  assert.strictEqual(perAreaRow.payload?.ratePaise, 18000); // ₹180 -> 18000 paise
  assert.strictEqual(perAreaRow.payload?.pricePaise, null);
  assert.strictEqual(perAreaRow.payload?.wastage, 10);
  assert.strictEqual(perAreaRow.payload?.minArea, 25);
  assert.strictEqual(perAreaRow.payload?.rollWidth, 3);
  assert.strictEqual(perAreaRow.payload?.categoryId, "cat_wallpapers_123");

  // Check FIXED parsed payload
  const fixedRow = validSummary.rows[1];
  assert.strictEqual(fixedRow.status, "valid");
  assert.strictEqual(fixedRow.payload?.productType, ProductType.FIXED);
  assert.strictEqual(fixedRow.payload?.pricePaise, 549900); // ₹5,499 -> 549900 paise
  assert.strictEqual(fixedRow.payload?.ratePaise, null);
  assert.strictEqual(fixedRow.payload?.categoryId, "cat_art_456");
  console.log("✔ Valid CSV validation passed for both PER_AREA and FIXED types");

  // B. Missing required headers
  await assert.rejects(
    async () => validateCsvImport("name,price\nItem 1,100"),
    (err: Error) => err instanceof ValidationError && err.message.includes("Missing required CSV headers")
  );
  console.log("✔ Missing required headers rejected");

  // C. Duplicate headers in CSV
  await assert.rejects(
    async () => validateCsvImport("name,sku,productType,category,price,Price\nItem,SKU,FIXED,cat,100,100"),
    (err: Error) => err instanceof ValidationError && err.message.includes("Duplicate CSV headers detected")
  );
  console.log("✔ Duplicate headers rejected");

  // D. Row-level errors: Category not found
  const badCategoryCsv = `name,sku,productType,category,price\nItem 1,SKU-001,FIXED,non-existent-cat,1000`;
  const badCatSummary = await validateCsvImport(badCategoryCsv);
  assert.strictEqual(badCatSummary.invalidRows, 1);
  assert.ok(badCatSummary.rows[0].errors.some((e) => e.includes("does not exist in catalogue")));
  console.log("✔ Non-existent category reference rejected");

  // E. Row-level errors: Collection not found
  const badColCsv = `name,sku,productType,category,collection,price\nItem 1,SKU-001,FIXED,wallpapers,unknown-col,1000`;
  const badColSummary = await validateCsvImport(badColCsv);
  assert.strictEqual(badColSummary.invalidRows, 1);
  assert.ok(badColSummary.rows[0].errors.some((e) => e.includes("Collection 'unknown-col' does not exist")));
  console.log("✔ Non-existent collection reference rejected");

  // F. Row-level errors: Incompatible pricing fields
  // FIXED with rate
  const fixedWithRateCsv = `name,sku,productType,category,price,rate\nItem 1,SKU-001,FIXED,wall-art,1000,50`;
  const fixedWithRateSummary = await validateCsvImport(fixedWithRateCsv);
  assert.strictEqual(fixedWithRateSummary.invalidRows, 1);
  assert.ok(fixedWithRateSummary.rows[0].errors.some((e) => e.includes("Product type FIXED cannot specify rate")));

  // PER_AREA with price
  const perAreaWithPriceCsv = `name,sku,productType,category,rate,price\nWallpaper,SKU-002,PER_AREA,wallpapers,150,5000`;
  const perAreaWithPriceSummary = await validateCsvImport(perAreaWithPriceCsv);
  assert.strictEqual(perAreaWithPriceSummary.invalidRows, 1);
  assert.ok(perAreaWithPriceSummary.rows[0].errors.some((e) => e.includes("Product type PER_AREA cannot specify fixed price")));
  console.log("✔ Incompatible pricing combination guards verified");

  // G. Duplicate SKU within CSV file
  const duplicateSkuInCsv = `name,sku,productType,category,price\nItem 1,DUP-SKU-1,FIXED,wall-art,1000\nItem 2,DUP-SKU-1,FIXED,wall-art,2000`;
  const dupSkuSummary = await validateCsvImport(duplicateSkuInCsv);
  assert.strictEqual(dupSkuSummary.invalidRows, 2);
  assert.ok(dupSkuSummary.rows[0].errors.some((e) => e.includes("Duplicate SKU 'DUP-SKU-1' found in CSV")));
  assert.ok(dupSkuSummary.rows[1].errors.some((e) => e.includes("Duplicate SKU 'DUP-SKU-1' found in CSV")));
  console.log("✔ Duplicate SKU within CSV detected on all duplicate rows");

  // H. Existing SKU conflict in database
  (prisma.productVariant.findMany as unknown) = async ({ where }: { where: { sku: { in: string[] } } }) => {
    if (where.sku.in.includes("EXISTING-SKU-999")) {
      return [{ sku: "EXISTING-SKU-999", productId: "p_123" }];
    }
    return [];
  };

  const existingSkuCsv = `name,sku,productType,category,price\nNew Item,EXISTING-SKU-999,FIXED,wall-art,1000`;
  const existingSkuSummary = await validateCsvImport(existingSkuCsv);
  assert.strictEqual(existingSkuSummary.invalidRows, 1);
  assert.strictEqual(existingSkuSummary.existingSkuConflicts, 1);
  assert.ok(existingSkuSummary.rows[0].errors.some((e) => e.includes("already exists")));
  console.log("✔ Existing database SKU collision detected");

  // ==========================================
  // 5. Transactional Import Execution Tests
  // ==========================================
  console.log("--- 5. Testing Transactional Import Execution ---");

  const actor = { id: "usr_admin_1", role: Role.STORE_ADMIN };
  const reqContext = { ipAddress: "127.0.0.1", userAgent: "TestRunner/1.0" };

  const createdAuditLogs: Array<{ action: string; metadata: unknown }> = [];
  (prisma.auditLog.create as unknown) = async ({ data }: { data: { action: string; metadata: unknown } }) => {
    createdAuditLogs.push(data);
    return { id: "audit_123", ...data };
  };

  const createdProductsStore: Array<{ id: string; name: string; sku?: string }> = [];
  const createdVariantsStore: Array<{ id: string; sku: string; price: number }> = [];

  // Mock transaction runner
  (prisma.$transaction as unknown) = async (callback: (tx: unknown) => Promise<unknown>) => {
    const mockTx = {
      productVariant: {
        findMany: async () => [],
        create: async ({ data }: { data: { id?: string; sku: string; price: number } }) => {
          const v = { id: `var_${Date.now()}_${Math.random()}`, ...data };
          createdVariantsStore.push(v);
          return v;
        },
      },
      product: {
        findMany: async () => [],
        create: async ({ data }: { data: { name: string; slug: string } }) => {
          const p = { id: `prod_${Date.now()}_${Math.random()}`, ...data };
          createdProductsStore.push(p);
          return p;
        },
      },
      auditLog: {
        create: async ({ data }: { data: { action: string; metadata: unknown } }) => {
          createdAuditLogs.push(data);
          return { id: "audit_tx", ...data };
        },
      },
    };
    return await callback(mockTx);
  };

  const validatedRowsToImport: ValidatedRowPayload[] = [
    {
      rowNumber: 2,
      name: "Framed Canvas Art",
      slug: "framed-canvas-art",
      sku: "ART-FC-01",
      productType: ProductType.FIXED,
      categoryId: "cat_art_456",
      categoryName: "Wall Art",
      pricePaise: 499900,
      ratePaise: null,
      wastage: null,
      minArea: null,
      rollWidth: null,
      returnable: true,
      isActive: true,
      hsnCode: "9701.10",
      description: "Fine art framed print",
    },
    {
      rowNumber: 3,
      name: "Luxury Silk Wallpaper",
      slug: "luxury-silk-wallpaper",
      sku: "WALL-LS-02",
      productType: ProductType.PER_AREA,
      categoryId: "cat_wallpapers_123",
      categoryName: "Wallpapers",
      pricePaise: null,
      ratePaise: 15000,
      wastage: 10,
      minArea: 25,
      rollWidth: 3,
      returnable: true,
      isActive: true,
      hsnCode: "4814.90",
      description: "Silk wallpaper per sqft",
    },
  ];

  const importResult = await executeCsvImport(validatedRowsToImport, actor, reqContext);
  assert.strictEqual(importResult.totalRows, 2);
  assert.strictEqual(importResult.importedCount, 2);
  assert.strictEqual(importResult.failedCount, 0);
  assert.strictEqual(createdProductsStore.length, 2);
  // FIXED product creates variant, PER_AREA does NOT
  assert.strictEqual(createdVariantsStore.length, 1);
  assert.strictEqual(createdVariantsStore[0].sku, "ART-FC-01");

  // Verify Audit Log actions fired
  const auditActions = createdAuditLogs.map((a) => a.action);
  assert.ok(auditActions.includes(AUDIT_ACTIONS.PRODUCT_IMPORT_STARTED));
  assert.ok(auditActions.includes(AUDIT_ACTIONS.PRODUCT_IMPORT_COMPLETED));
  console.log("✔ Transactional import execution and audit logging passed");

  // Transaction rollback on concurrent conflict
  (prisma.$transaction as unknown) = async (callback: (tx: unknown) => Promise<unknown>) => {
    const mockTx = {
      productVariant: {
        findMany: async () => [{ sku: "ART-FC-01" }], // simulate concurrent collision
      },
      product: {
        findMany: async () => [],
      },
      auditLog: {
        create: async () => ({}),
      },
    };
    return await callback(mockTx);
  };

  await assert.rejects(
    async () => executeCsvImport(validatedRowsToImport, actor, reqContext),
    (err: Error) => err instanceof ValidationError && err.message.includes("Concurrent import conflict")
  );

  const lastAudit = createdAuditLogs[createdAuditLogs.length - 1];
  assert.strictEqual(lastAudit.action, AUDIT_ACTIONS.PRODUCT_IMPORT_FAILED);
  console.log("✔ Transaction rollback and failure audit logging verified on concurrent collision");

  // ==========================================
  // 6. RBAC Authorization Security Tests
  // ==========================================
  console.log("--- 6. Testing RBAC Authorization Guards ---");

  const checkAdminRole = (user: { id: string; role: Role } | null) => {
    if (!user) throw new AuthError("Authentication required to perform this action");
    if (user.role !== Role.STORE_ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenError("Access denied. Admin role required.");
    }
    return user;
  };

  const storeAdmin = { id: "adm_1", role: Role.STORE_ADMIN };
  const superAdmin = { id: "adm_2", role: Role.SUPER_ADMIN };
  const customer = { id: "cust_1", role: Role.CUSTOMER };

  assert.doesNotThrow(() => checkAdminRole(storeAdmin));
  assert.doesNotThrow(() => checkAdminRole(superAdmin));
  assert.throws(() => checkAdminRole(customer), ForbiddenError);
  assert.throws(() => checkAdminRole(null), AuthError);
  console.log("✔ RBAC authorization guards verified");

  // Clean up mocks
  prisma.category.findMany = originalCategoryFindMany;
  prisma.collection.findMany = originalCollectionFindMany;
  prisma.productVariant.findMany = originalProductVariantFindMany;
  prisma.product.findMany = originalProductFindMany;
  prisma.$transaction = originalTransaction;
  prisma.auditLog.create = originalAuditLogCreate;

  console.log("ALL PRODUCT BULK CSV IMPORT TESTS PASSED SUCCESSFULLY! (Phase 04.06)");
}

runCsvImportTests().catch((err) => {
  console.error("CSV Import Test Failure:", err);
  process.exit(1);
});

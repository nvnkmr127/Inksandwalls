import { execSync } from "node:child_process";

console.log("=== Stage 1: Platform Foundation & Admin Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; require('./src/lib/media/__tests__/pipeline.test.ts'); require('./src/lib/__tests__/observability.test.ts'); require('./src/components/__tests__/ui-kit.test.ts'); require('./src/lib/auth/__tests__/auth.test.ts'); require('./src/lib/auth/__tests__/whatsapp-otp.test.ts'); require('./src/lib/auth/__tests__/google-auth.test.ts'); require('./src/components/auth/__tests__/auth-ui.test.ts'); require('./src/lib/auth/__tests__/user-roles.test.ts'); require('./src/lib/auth/__tests__/rbac.test.ts'); require('./src/lib/audit/__tests__/audit.test.ts'); require('./src/lib/categories/__tests__/categories.test.ts'); require('./src/lib/collections/__tests__/collections.test.ts'); require('./src/lib/products/__tests__/products.test.ts'); require('./src/lib/product-variants/__tests__/variants.test.ts'); require('./src/lib/product-media/__tests__/media.test.ts'); require('./src/lib/products/__tests__/csv-import.test.ts');"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 2: Storefront Catalog Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; require('./src/lib/storefront/__tests__/catalog.test.ts');"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 3: Product Detail, Canonical Pricing & Cart Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; (async () => { require('./src/lib/pricing/__tests__/pricing.test.ts').runPricingEngineTests(); await require('./src/lib/storefront/__tests__/product-detail.test.ts').runProductDetailStorefrontTests(); await require('./src/lib/cart/__tests__/cart.test.ts').runCartBoundaryTests(); await require('./src/lib/cart/__tests__/cart-db.test.ts').runCartDatabaseServiceTests(); })();"`,
  { stdio: "inherit" }
);

console.log("\n✔ ALL INKS & WALLS TEST SUITES PASSED SUCCESSFULLY!");

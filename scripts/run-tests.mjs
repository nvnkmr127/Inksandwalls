import { execSync } from "node:child_process";

console.log("=== Stage 1: Platform Foundation & Admin Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; require('./src/lib/media/__tests__/pipeline.test.ts'); require('./src/lib/__tests__/observability.test.ts'); require('./src/components/__tests__/ui-kit.test.ts'); require('./src/lib/auth/__tests__/auth.test.ts'); require('./src/lib/auth/__tests__/whatsapp-otp.test.ts'); require('./src/lib/auth/__tests__/google-auth.test.ts'); require('./src/components/auth/__tests__/auth-ui.test.ts'); require('./src/lib/auth/__tests__/user-roles.test.ts'); require('./src/lib/auth/__tests__/rbac.test.ts'); require('./src/lib/audit/__tests__/audit.test.ts'); require('./src/lib/categories/__tests__/categories.test.ts'); require('./src/lib/collections/__tests__/collections.test.ts'); require('./src/lib/products/__tests__/products.test.ts'); require('./src/lib/product-variants/__tests__/variants.test.ts'); require('./src/lib/product-media/__tests__/media.test.ts'); require('./src/lib/products/__tests__/csv-import.test.ts'); require('./src/lib/pages/__tests__/pages.test.ts');"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 2: Storefront Catalog Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; require('./src/lib/storefront/__tests__/catalog.test.ts');"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 3: Product Detail, Canonical Pricing, Cart & Coupon Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; (async () => { require('./src/lib/pricing/__tests__/pricing.test.ts').runPricingEngineTests(); await require('./src/lib/storefront/__tests__/product-detail.test.ts').runProductDetailStorefrontTests(); await require('./src/lib/cart/__tests__/cart.test.ts').runCartBoundaryTests(); await require('./src/lib/cart/__tests__/cart-db.test.ts').runCartDatabaseServiceTests(); await require('./src/lib/coupons/__tests__/coupon.test.ts').runCouponEngineTests(); await require('./src/lib/coupons/__tests__/coupon-admin.test.ts').runCouponAdminTests(); })();"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 4: Address, Shipping & Checkout Totals Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; require('./src/lib/address/__tests__/address.test.ts').runAddressTests(); require('./src/lib/shipping/__tests__/shipping.test.ts').runShippingEngineTests(); require('./src/lib/checkout/__tests__/checkout-totals.test.ts').runCheckoutTotalsEngineTests();"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 5: GST / Tax Computation & Invoice PDF -> R2 Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; (async () => { require('./src/lib/tax/__tests__/tax.test.ts').runTaxEngineTests(); await require('./src/lib/invoice/__tests__/invoice.test.ts').runInvoiceTests(); })();"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 6: Payment Gates & Order Placement Transaction Tests ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; (async () => { require('./src/lib/payment/__tests__/payment-gate.test.ts').runPaymentGateTests(); await require('./src/lib/order/__tests__/order-transaction.test.ts').runOrderTransactionTests(); })();"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 7: Transactional Email Notifications ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; (async () => { await require('./src/lib/email/__tests__/email.test.ts').runEmailTests(); })();"`,
  { stdio: "inherit" }
);

console.log("\n=== Stage 8: WABA Order Notifications (Queue) ===");
execSync(
  `tsx -e "require('module')._cache[require.resolve('server-only')] = { exports: {} }; process.env.NODE_ENV = 'test'; (async () => { await require('./src/lib/queue/__tests__/waba-queue.test.ts').runWabaQueueTests(); })();"`,
  { stdio: "inherit" }
);

console.log("\n✔ ALL INKS & WALLS TEST SUITES PASSED SUCCESSFULLY!");


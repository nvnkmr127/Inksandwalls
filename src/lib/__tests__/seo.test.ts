import assert from "assert";

import { buildOrganizationSchema, buildBreadcrumbSchema, buildProductSchema, buildLocalBusinessSchema } from "../seo/schema";
import { siteConfig } from "@/config/site";

export const runSeoTests = async () => {
  console.log("Running SEO Metadata tests...");
  
  // Test Production Origin Handling
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://inksandwalls.com";
  assert.ok(origin.startsWith("http"), "Production origin should be an absolute URL");
  
  // Test Organization Schema
  const orgSchema = buildOrganizationSchema() as Record<string, unknown>;
  assert.strictEqual(orgSchema["@type"], "Organization");
  assert.ok(orgSchema.name);
  assert.ok(orgSchema.url);

  // Test Breadcrumb Schema
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", url: "https://example.com" },
    { name: "Products", url: "https://example.com/products" },
  ]) as any;
  assert.strictEqual(breadcrumbSchema["@type"], "BreadcrumbList");
  assert.strictEqual(breadcrumbSchema.itemListElement.length, 2);
  assert.strictEqual(breadcrumbSchema.itemListElement[1].item.name, "Products");

  // Test Product Schema
  const productSchema = buildProductSchema({
    name: "Test Product",
    url: "https://example.com/test",
    productType: "FIXED",
    price: 100000, // 1000 INR
    currency: "INR",
    availability: "InStock",
    reviews: [
      { rating: 5, authorName: "Alice" },
      { rating: 4, authorName: "Bob" },
    ]
  }) as any;
  assert.strictEqual(productSchema["@type"], "Product");
  assert.strictEqual(productSchema.name, "Test Product");
  assert.strictEqual(productSchema.offers.price, "1000.00");
  assert.strictEqual(productSchema.review.length, 2);
  assert.strictEqual(productSchema.aggregateRating.ratingValue, "4.5");

  // Test PER_AREA Product Schema without offers
  const perAreaSchema = buildProductSchema({
    name: "Wall Art",
    url: "https://example.com/art",
    productType: "PER_AREA",
    rate: 20000, // 200 INR
  }) as Record<string, unknown>;
  assert.strictEqual(perAreaSchema.offers, undefined, "PER_AREA should not have fixed offers");

  // Phase 12.05: GSC and LocalBusiness Schema
  console.log("Running Phase 12.05 GSC & Local SEO Foundation tests...");
  
  // Test GSC verification config
  // In a test environment, siteConfig.googleSiteVerification could be undefined or a string
  const verificationValue = siteConfig.googleSiteVerification;
  assert.ok(verificationValue === undefined || typeof verificationValue === 'string', "GSC verification config should be string or undefined, not breaking");

  // Test LocalBusiness schema with available config
  const localBusinessSchema = buildLocalBusinessSchema() as Record<string, unknown>;
  assert.strictEqual(localBusinessSchema["@type"], "LocalBusiness");
  assert.strictEqual(localBusinessSchema.name, siteConfig.name, "Name must be consistent");
  assert.strictEqual(localBusinessSchema.url, siteConfig.url, "URL must be consistent");
  
  if (siteConfig.contact.phone) {
    assert.strictEqual(localBusinessSchema.telephone, siteConfig.contact.phone, "Phone must match if present");
  }

  // Missing config shouldn't crash (already tested by the fact it returns)
  assert.ok(localBusinessSchema, "LocalBusiness schema builds successfully");

  // Organization schema consistency
  const orgSchemaCheck = buildOrganizationSchema() as Record<string, unknown>;
  assert.strictEqual(orgSchemaCheck.name, localBusinessSchema.name, "Organization and LocalBusiness names must match");
  assert.strictEqual(orgSchemaCheck.url, localBusinessSchema.url, "Organization and LocalBusiness URLs must match");

  // No localhost in production config
  if (process.env.NODE_ENV === "production") {
    assert.ok(!siteConfig.url.includes("localhost"), "Production URL should not contain localhost");
    assert.ok(!JSON.stringify(localBusinessSchema).includes("localhost"), "Production schema should not contain localhost");
  }

  console.log("SEO tests passed!");
};

// Auto-run if executed directly
if (require.main === module) {
  runSeoTests().catch(console.error);
}

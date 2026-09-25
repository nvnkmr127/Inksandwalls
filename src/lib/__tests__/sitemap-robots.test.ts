import assert from "assert";
import { prisma } from '@/lib/prisma';

// Mock prisma
// @ts-expect-error Mocking PrismaPromise for tests
prisma.product.findMany = async () => [{ slug: 'product-1', updatedAt: new Date() }] as any;
// @ts-expect-error Mocking PrismaPromise for tests
prisma.category.findMany = async () => [{ slug: 'category-1', updatedAt: new Date() }] as any;
// @ts-expect-error Mocking PrismaPromise for tests
prisma.collection.findMany = async () => [{ slug: 'collection-1', updatedAt: new Date() }] as any;
// @ts-expect-error Mocking PrismaPromise for tests
prisma.blogPost.findMany = async () => [{ slug: 'post-1', updatedAt: new Date() }] as any;
// @ts-expect-error Mocking PrismaPromise for tests
prisma.page.findMany = async () => [{ slug: 'about', updatedAt: new Date() }] as any;

import sitemap from '../../app/sitemap';
import robots from '../../app/robots';
import { siteConfig } from '@/config/site';

export const runSitemapRobotsTests = async () => {
  console.log("Running Sitemap & Robots (Phase 12.03) tests...");
  
  // Test Robots
  const robotsData = robots();
  assert.ok(robotsData.rules, "Robots should have rules");
  assert.strictEqual(robotsData.sitemap, `${siteConfig.url}/sitemap.xml`, "Robots should have sitemap URL");
  
  const rules = Array.isArray(robotsData.rules) ? robotsData.rules[0] : robotsData.rules;
  assert.strictEqual(rules?.allow, "/", "Robots should allow root");
  assert.ok(rules?.disallow?.includes("/admin/"), "Robots should disallow /admin/");
  assert.ok(rules?.disallow?.includes("/account/"), "Robots should disallow /account/");
  assert.ok(rules?.disallow?.includes("/cart/"), "Robots should disallow /cart/");
  assert.ok(rules?.disallow?.includes("/checkout/"), "Robots should disallow /checkout/");

  // Test Sitemap
  const sitemapData = await sitemap();
  assert.ok(Array.isArray(sitemapData), "Sitemap should return an array of routes");
  assert.ok(sitemapData.length >= 3, "Sitemap should have at least the base, products, and blog routes");
  
  const urls = sitemapData.map(s => s.url);
  assert.ok(urls.includes(siteConfig.url), "Sitemap should include base URL");
  assert.ok(urls.includes(`${siteConfig.url}/products`), "Sitemap should include /products URL");
  assert.ok(urls.includes(`${siteConfig.url}/blog`), "Sitemap should include /blog URL");

  console.log("Sitemap & Robots tests passed!");
};

// Auto-run if executed directly
if (require.main === module) {
  runSitemapRobotsTests().catch(console.error);
}

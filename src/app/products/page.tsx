import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import {
  getStorefrontNavData,
  getStorefrontProducts,
} from "@/lib/storefront/catalog-service";
import { ProductCard } from "@/components/storefront/product-card";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import { CatalogPagination } from "@/components/storefront/catalog-pagination";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";
import { JsonLd, buildBreadcrumbSchema } from "@/lib/seo/schema";

interface ProductsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  searchParams,
}: ProductsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const categoryParam = typeof params.category === "string" ? params.category : undefined;
  const collectionParam = typeof params.collection === "string" ? params.collection : undefined;
  const searchParam = typeof params.search === "string" ? params.search : undefined;

  const result = await getStorefrontProducts({
    category: categoryParam,
    collection: collectionParam,
    search: searchParam,
    pageSize: 1, // Only need metadata
  });

  let title = "Product Catalogue";
  let description = `Discover bespoke custom wallpapers, acoustic murals, and fine art prints from ${siteConfig.name}.`;
  let canonical = "/products";

  if (result.activeCategory) {
    title = `${result.activeCategory.name} | ${siteConfig.name}`;
    description = result.activeCategory.description || description;
    canonical = `/products?category=${result.activeCategory.slug}`;
  } else if (result.activeCollection) {
    title = `${result.activeCollection.name} | ${siteConfig.name}`;
    description = result.activeCollection.description || description;
    canonical = `/products?collection=${result.activeCollection.slug}`;
  } else if (searchParam) {
    title = `Search: "${searchParam}" | ${siteConfig.name}`;
    canonical = `/products?search=${encodeURIComponent(searchParam)}`;
  } else {
    title = `Wallpapers, Murals & Wall Art | ${siteConfig.name}`;
  }

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
    },
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;

  const category = typeof params.category === "string" ? params.category : undefined;
  const collection = typeof params.collection === "string" ? params.collection : undefined;
  const type = typeof params.type === "string" ? params.type : undefined;
  const sort = typeof params.sort === "string" ? params.sort : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const page = typeof params.page === "string" ? params.page : undefined;

  // Run catalog queries
  const [navData, result] = await Promise.all([
    getStorefrontNavData(),
    getStorefrontProducts({
      category,
      collection,
      type,
      sort,
      search,
      page,
      pageSize: 12,
    }),
  ]);

  // Derive heading title
  let headingTitle = "All Products";
  let headingDescription: string | null = "Explore our handcrafted collection of wallpapers and wall art.";

  if (result.activeCategory) {
    headingTitle = result.activeCategory.name;
    headingDescription =
      result.activeCategory.description || `Browse bespoke designs in ${result.activeCategory.name}.`;
  } else if (result.activeCollection) {
    headingTitle = result.activeCollection.name;
    headingDescription =
      result.activeCollection.description || `Curated selections in ${result.activeCollection.name}.`;
  } else if (search) {
    headingTitle = `Search Results for "${search}"`;
    headingDescription = `Found ${result.totalCount} product${result.totalCount === 1 ? "" : "s"} matching your search.`;
  }

  const breadcrumbItems = [
    { name: "Home", url: siteConfig.url },
    { name: "Catalogue", url: `${siteConfig.url}/products` },
  ];
  if (result.activeCategory) {
    breadcrumbItems.push({
      name: result.activeCategory.name,
      url: `${siteConfig.url}/products?category=${result.activeCategory.slug}`,
    });
  } else if (result.activeCollection) {
    breadcrumbItems.push({
      name: result.activeCollection.name,
      url: `${siteConfig.url}/products?collection=${result.activeCollection.slug}`,
    });
  }
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems);

  return (
    <>
      <JsonLd schema={breadcrumbSchema} />
      <div className="container max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {headingTitle}
          </h1>
          <span className="text-sm text-muted-foreground font-medium">
            {result.totalCount} {result.totalCount === 1 ? "Product" : "Products"}
          </span>
        </div>
        {headingDescription && (
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            {headingDescription}
          </p>
        )}
      </header>

      {/* Catalog Filters Bar */}
      <CatalogFilters
        categories={navData.categories}
        collections={navData.collections}
        activeCategory={result.activeCategory?.slug || category}
        activeCollection={result.activeCollection?.slug || collection}
        activeType={type}
        activeSort={sort}
        activeSearch={search}
      />

      {/* Product Listing Grid or Empty State */}
      {result.items.length > 0 ? (
        <section aria-label="Product listings">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {result.items.map((product, idx) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={idx < 4}
              />
            ))}
          </div>

          {/* Pagination */}
          <CatalogPagination
            currentPage={result.page}
            totalPages={result.totalPages}
          />
        </section>
      ) : (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="No products found"
          description={
            search
              ? `No products matched your search "${search}". Try searching with different keywords or clearing active filters.`
              : result.activeCategory
              ? `No active products are currently available in "${result.activeCategory.name}".`
              : "No products matched your filter selection."
          }
          action={
            <Link href="/products" passHref>
              <Button variant="outline">
                Clear Filters & View All
              </Button>
            </Link>
          }
          className="my-12 py-16"
        />
      )}
    </div>
    </>
  );
}

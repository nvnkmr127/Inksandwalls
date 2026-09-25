import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getStorefrontProductBySlug } from "@/lib/storefront/catalog-service";
import { formatProductPriceDisplay } from "@/lib/money";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductConfigurator } from "@/components/storefront/product-configurator";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { ChevronRight, ShieldCheck, Truck, Star } from "lucide-react";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Dynamic SEO metadata generation for PDP.
 */
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);

  if (!product) {
    return {
      title: `Product Not Found | ${siteConfig.name}`,
      description: "The requested wallpaper or wall art product could not be found.",
    };
  }

  const primaryImage = product.media?.[0]?.objectKey
    ? `/api/media/upload?key=${encodeURIComponent(product.media[0].objectKey)}`
    : undefined;

  return {
    title: `${product.name} | ${siteConfig.name}`,
    description:
      product.description ||
      `Order bespoke custom made-to-order ${product.name} from ${siteConfig.name}.`,
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} | ${siteConfig.name}`,
      description:
        product.description ||
        `Order bespoke custom made-to-order ${product.name} from ${siteConfig.name}.`,
      url: `/products/${product.slug}`,
      siteName: siteConfig.name,
      images: primaryImage ? [{ url: primaryImage, alt: product.media[0]?.altText || product.name }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const isPerArea = product.productType === "PER_AREA";
  const pricing = formatProductPriceDisplay(product);

  return (
    <div className="container max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/products" className="hover:text-foreground transition-colors">
          Catalogue
        </Link>
        {product.category && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-xs" aria-current="page">
          {product.name}
        </span>
      </nav>

      {/* Main Product Presentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Media Gallery */}
        <div className="lg:col-span-7">
          <ProductGallery
            media={product.media}
            productName={product.name}
            isPerArea={isPerArea}
            isReturnable={product.returnable}
          />
        </div>

        {/* Right Column: Product Info & Configurator */}
        <div className="lg:col-span-5 space-y-6">
          {/* Header & Meta */}
          <div className="space-y-2 border-b border-border pb-6">
            {product.category && (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {product.category.name}
              </span>
            )}

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {product.name}
            </h1>

            {/* Base Price Representation */}
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-2xl sm:text-3xl font-bold text-foreground">
                {pricing.formattedPrice}
              </span>
              {pricing.unitLabel && (
                <span className="text-sm font-medium text-muted-foreground">
                  {pricing.unitLabel}
                </span>
              )}
            </div>

            {/* Rating Summary Link */}
            {product.reviewSummary.totalCount > 0 && (
              <div className="flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
                <div className="flex text-yellow-500">
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <span className="font-medium text-foreground">{product.reviewSummary.averageRating.toFixed(1)}</span>
                <span>({product.reviewSummary.totalCount} reviews)</span>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-sm text-muted-foreground leading-relaxed pt-2">
                {product.description}
              </p>
            )}
          </div>

          {/* Product Configurator */}
          <ProductConfigurator
            productId={product.id}
            productName={product.name}
            productSlug={product.slug}
            productType={product.productType}
            basePrice={product.price}
            rate={product.rate}
            wastage={product.wastage}
            minArea={product.minArea}
            rollWidth={product.rollWidth}
            variants={product.variants}
            returnable={product.returnable}
          />

          {/* Trust Guarantees Card */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-xs text-muted-foreground bg-muted/20">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>Premium Architectural Grade Materials</span>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-xs text-muted-foreground bg-muted/20">
              <Truck className="h-4 w-4 text-primary shrink-0" />
              <span>Free Insured Pan-India Shipping</span>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications & Architectural Information Section */}
      <section className="border-t border-border pt-10 space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Product Specifications
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Technical attributes, dimensions, and manufacturing standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Product Type
            </span>
            <p className="text-sm font-medium text-foreground">
              {isPerArea ? "Bespoke Made-to-Order Wallpaper" : "Framed Fine Art Print"}
            </p>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Category
            </span>
            <p className="text-sm font-medium text-foreground">
              {product.category?.name || "Standard Catalogue"}
            </p>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Return Policy
            </span>
            <p className="text-sm font-medium text-foreground">
              {!product.returnable
                ? "Custom-Cut (Made-to-Order, Non-Returnable)"
                : "7-Day Return Policy"}
            </p>
          </div>

          {product.hsnCode && (
            <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                HSN Code
              </span>
              <p className="text-sm font-medium text-foreground font-mono">
                {product.hsnCode}
              </p>
            </div>
          )}

          {isPerArea && product.minArea != null && (
            <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Minimum Billable Area
              </span>
              <p className="text-sm font-medium text-foreground">
                {product.minArea} sq ft
              </p>
            </div>
          )}

          {isPerArea && product.wastage != null && (
            <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Wastage Allowance
              </span>
              <p className="text-sm font-medium text-foreground">
                {product.wastage}% standard trimming allowance
              </p>
            </div>
          )}

          {isPerArea && product.rollWidth != null && (
            <div className="rounded-xl border border-border p-4 space-y-1 bg-card">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Standard Roll Width
              </span>
              <p className="text-sm font-medium text-foreground">
                {product.rollWidth} ft
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Customer Reviews Section */}
      <section className="border-t border-border pt-10 space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Customer Reviews
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real feedback from verified purchasers.
          </p>
        </div>
        
        <ProductReviews reviews={product.reviews} summary={product.reviewSummary} />
      </section>
    </div>
  );
}

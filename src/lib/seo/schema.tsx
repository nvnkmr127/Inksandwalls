import React from "react";
import { siteConfig } from "@/config/site";

export type SchemaContext = {
  url: string;
};

export function buildOrganizationSchema() {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo.png`, // Assuming a standard logo path
    contactPoint: {
      "@type": "ContactPoint",
      email: siteConfig.contact.email,
      contactType: "customer support",
      hoursAvailable: siteConfig.contact.supportHours,
    },
  };

  if (siteConfig.contact.phone) {
    (schema.contactPoint as Record<string, unknown>).telephone = siteConfig.contact.phone;
  }

  if (siteConfig.gbpUrl) {
    schema.sameAs = [siteConfig.gbpUrl];
  }

  return schema;
}

export function buildLocalBusinessSchema() {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: siteConfig.name,
    image: `${siteConfig.url}/logo.png`,
    url: siteConfig.url,
  };

  if (siteConfig.contact.phone) {
    schema.telephone = siteConfig.contact.phone;
  }
  if (siteConfig.contact.email) {
    schema.email = siteConfig.contact.email;
  }

  if (siteConfig.address?.streetAddress) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.streetAddress,
      addressLocality: siteConfig.address.addressLocality,
      addressRegion: siteConfig.address.addressRegion,
      postalCode: siteConfig.address.postalCode,
      addressCountry: siteConfig.address.addressCountry,
    };
  }

  if (siteConfig.gbpUrl) {
    schema.sameAs = [siteConfig.gbpUrl];
  }

  return schema;
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@id": item.url,
        name: item.name,
      },
    })),
  };
}

type ProductSchemaInput = {
  name: string;
  description?: string | null;
  url: string;
  image?: string;
  sku?: string;
  brand?: string;
  productType?: string;
  price?: number | null; // In paise
  rate?: number | null; // In paise
  currency?: string;
  availability?: "InStock" | "OutOfStock";
  reviews?: Array<{
    rating: number;
    content?: string | null;
    authorName?: string;
    datePublished?: string;
  }>;
};

export function buildProductSchema(input: ProductSchemaInput) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url: input.url,
  };

  if (input.description) schema.description = input.description;
  if (input.image) schema.image = input.image;
  if (input.sku) schema.sku = input.sku;
  if (input.brand) {
    schema.brand = {
      "@type": "Brand",
      name: input.brand,
    };
  }

  // Handle Offer
  if (input.productType === "FIXED" && input.price != null && input.price > 0) {
    schema.offers = {
      "@type": "Offer",
      url: input.url,
      priceCurrency: input.currency || "INR",
      price: (input.price / 100).toFixed(2),
      availability:
        input.availability === "InStock"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    };
  }

  // Handle Reviews
  if (input.reviews && input.reviews.length > 0) {
    let totalRating = 0;
    const reviewSchema = input.reviews.map((r) => {
      totalRating += r.rating;
      return {
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5,
        },
        author: {
          "@type": "Person",
          name: r.authorName || "Customer",
        },
        reviewBody: r.content || undefined,
        datePublished: r.datePublished || undefined,
      };
    });

    schema.review = reviewSchema;
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: (totalRating / input.reviews.length).toFixed(1),
      reviewCount: input.reviews.length,
    };
  }

  return schema;
}

export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  if (!schema) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/config/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  const [
    products,
    categories,
    collections,
    blogPosts,
    pages
  ] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true }
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true }
    }),
    prisma.collection.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true }
    }),
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true }
    }),
    prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true }
    })
  ]);

  const productUrls: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const categoryUrls: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${baseUrl}/products?category=${category.slug}`,
    lastModified: category.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const collectionUrls: MetadataRoute.Sitemap = collections.map((collection) => ({
    url: `${baseUrl}/products?collection=${collection.slug}`,
    lastModified: collection.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const blogUrls: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const pageUrls: MetadataRoute.Sitemap = pages.map((page) => ({
    url: `${baseUrl}/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...pageUrls,
    ...categoryUrls,
    ...collectionUrls,
    ...productUrls,
    ...blogUrls,
  ];
}

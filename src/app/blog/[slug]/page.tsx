import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ReactMarkdown from "react-markdown";
import { siteConfig } from "@/config/site";
import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug, status: "PUBLISHED" },
  });

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const primaryImage = post.featuredImage
    ? `/api/media/upload?key=${encodeURIComponent(post.featuredImage)}`
    : undefined;

  return {
    title: `${post.title} | ${siteConfig.name}`,
    description: post.excerpt || `Read ${post.title} on ${siteConfig.name}`,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt || `Read ${post.title} on ${siteConfig.name}`,
      url: `/blog/${post.slug}`,
      siteName: siteConfig.name,
      type: "article",
      images: primaryImage ? [{ url: primaryImage }] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const post = await prisma.blogPost.findUnique({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      excerpt: true,
      content: true,
      featuredImage: true,
      publishedAt: true,
    }
  });

  if (!post) {
    notFound();
  }

  return (
    <article className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-3xl space-y-8">
      <Link href="/blog" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Blog
      </Link>

      <div className="space-y-6">
        <div className="space-y-4">
          {post.publishedAt && (
            <time className="text-sm font-medium text-primary uppercase tracking-widest block">
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          )}
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              {post.excerpt}
            </p>
          )}
        </div>

        {post.featuredImage && (
          <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media/upload?key=${encodeURIComponent(post.featuredImage)}`}
              alt={post.title}
              className="object-cover w-full h-full"
            />
          </div>
        )}

        <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </div>
    </article>
  );
}

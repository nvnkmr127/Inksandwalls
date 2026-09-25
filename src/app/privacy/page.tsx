import { PublicPage } from "@/components/pages/public-page";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
  const page = await prisma.page.findUnique({
    where: { slug: "privacy" },
  });

  if (!page || page.status !== "PUBLISHED") {
    return {
      title: "Not Found",
    };
  }

  const excerpt = page.content.substring(0, 150).replace(/\n/g, ' ') + '...';

  return {
    title: `${page.title} | ${siteConfig.name}`,
    description: excerpt,
    alternates: {
      canonical: "/privacy",
    },
    openGraph: {
      title: page.title,
      description: excerpt,
      url: "/privacy",
    }
  };
}

export default function Page() {
  return <PublicPage slug="privacy" />;
}

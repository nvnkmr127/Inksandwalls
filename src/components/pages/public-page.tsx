import * as React from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface PublicPageProps {
  slug: string;
}

export async function PublicPage({ slug }: PublicPageProps) {
  const page = await prisma.page.findUnique({
    where: { slug },
  });

  if (!page || page.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-8 text-foreground">
        {page.title}
      </h1>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown>{page.content}</ReactMarkdown>
      </div>
    </div>
  );
}

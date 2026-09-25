import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageForm } from "../page-form";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const page = await prisma.page.findUnique({
    where: { id: resolvedParams.id },
  });

  if (!page) {
    notFound();
  }

  // Map to View structure
  const pageView = {
    ...page,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Page</h1>
        <p className="text-sm text-muted-foreground">Modify existing page content.</p>
      </div>
      <PageForm initialData={pageView} />
    </div>
  );
}

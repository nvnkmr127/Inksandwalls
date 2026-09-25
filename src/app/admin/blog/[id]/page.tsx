import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { BlogForm } from "../blog-form";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  
  const post = await prisma.blogPost.findUnique({
    where: { id },
  });

  if (!post) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Blog Post</h1>
        <p className="text-sm text-muted-foreground">
          Update the article content and publication status.
        </p>
      </div>
      <BlogForm initialData={post} />
    </div>
  );
}

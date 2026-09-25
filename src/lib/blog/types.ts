import { z } from "zod";
import { PostStatus } from "@prisma/client";

export const createBlogPostSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10, "Content must be at least 10 characters"),
  status: z.nativeEnum(PostStatus).default("DRAFT"),
  featuredImage: z.string().optional(),
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;

export const updateBlogPostSchema = createBlogPostSchema.partial();

export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;

// Shared interface for blog post views
export interface BlogPostView {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: PostStatus;
  featuredImage: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
